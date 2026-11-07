/**
 * Akash room logic — runtime-agnostic. Used by the Node server and the Cloudflare Durable Object.
 * A room is a set of sockets; the server only forwards presence and opaque signal blobs.
 * Nothing here persists anything.
 */
import type { ClientSignalMsg, PeerInfo, RoomKind, ServerSignalMsg } from '@narad/core'
import { RateLimiter, type AuditSink } from './limits'
import { capacityFor, verifyLicense } from '@narad/license'

export interface SocketLike {
  send(data: string): void
  close(code?: number, reason?: string): void
}

export const MAX_PEERS_PER_ROOM = 50
const MAX_MSG_BYTES = 64 * 1024
/** Signaling is bursty during ICE (tens of candidates), then quiet: 40 burst, 10/s sustained. */
const RATE_BURST = 40
const RATE_PER_SEC = 10

export class Room {
  private members = new Map<SocketLike, PeerInfo>()
  private limiters = new WeakMap<SocketLike, RateLimiter>()
  constructor(
    readonly id: string,
    readonly kind: RoomKind,
    private readonly opts: { capacity?: number; audit?: AuditSink; licensePublicKey?: string } = {},
  ) {}

  private licensed = 0

  get capacity(): number {
    return Math.max(this.opts.capacity ?? MAX_PEERS_PER_ROOM, this.licensed)
  }

  /** A valid Team license presented by any member lifts this room's capacity for everyone in it. */
  async applyLicense(token: string | undefined): Promise<boolean> {
    if (!token || !this.opts.licensePublicKey) return false
    const claims = await verifyLicense(token, this.opts.licensePublicKey)
    if (!claims) return false
    this.licensed = Math.max(this.licensed, capacityFor(claims, this.opts.capacity ?? MAX_PEERS_PER_ROOM))
    return true
  }

  /** Short hash of the room id for logs (never the code itself). */
  get auditId(): string {
    let h = 2166136261
    for (let i = 0; i < this.id.length; i++) h = Math.imul(h ^ this.id.charCodeAt(i), 16777619)
    return (h >>> 0).toString(16)
  }

  get size(): number {
    return this.members.size
  }

  peerIds(): string[] {
    return [...this.members.values()].map((p) => p.id)
  }

  /** Handle one raw message from a socket. Returns false if the socket should be closed. */
  handle(ws: SocketLike, raw: string): boolean {
    if (raw.length > MAX_MSG_BYTES) {
      this.opts.audit?.({ ev: 'limit', what: 'payload', ts: Date.now() })
      this.error(ws, 'message too large')
      return false
    }
    let rl = this.limiters.get(ws)
    if (!rl) this.limiters.set(ws, (rl = new RateLimiter(RATE_BURST, RATE_PER_SEC)))
    if (!rl.take()) {
      this.opts.audit?.({ ev: 'limit', what: 'rate', ts: Date.now() })
      this.error(ws, 'slow down')
      return false
    }
    let msg: ClientSignalMsg
    try {
      msg = JSON.parse(raw) as ClientSignalMsg
    } catch {
      this.error(ws, 'bad json')
      return false
    }
    switch (msg.t) {
      case 'join':
        if (msg.license && this.opts.licensePublicKey) {
          // async verification, then join; messages before that are queued by the caller's socket buffer
          void this.applyLicense(msg.license).then(() => {
            if (!this.join(ws, msg.peer)) ws.close(4002, 'protocol')
          })
          return true
        }
        return this.join(ws, msg.peer)
      case 'signal': {
        const from = this.members.get(ws)
        if (!from) {
          this.error(ws, 'join first')
          return false
        }
        if (typeof msg.to !== 'string') return true
        for (const [sock, peer] of this.members) {
          if (peer.id === msg.to) {
            this.send(sock, { t: 'signal', from: from.id, data: msg.data })
            break
          }
        }
        return true
      }
      case 'ping':
        this.send(ws, { t: 'pong' })
        return true
      default:
        return true
    }
  }

  join(ws: SocketLike, peer: PeerInfo): boolean {
    if (!isValidPeer(peer)) {
      this.error(ws, 'invalid peer')
      return false
    }
    if (this.members.has(ws)) return true
    if (this.members.size >= this.capacity) {
      this.opts.audit?.({ ev: 'limit', what: 'room-full', ts: Date.now() })
      this.error(ws, 'room full')
      return false
    }
    // A reconnecting tab with the same session id replaces its stale socket.
    for (const [sock, p] of this.members) {
      if (p.id === peer.id) {
        this.members.delete(sock)
        try {
          sock.close(4000, 'replaced')
        } catch {
          /* noop */
        }
      }
    }
    const sanitized: PeerInfo = {
      id: peer.id,
      deviceId: peer.deviceId,
      name: String(peer.name).slice(0, 40),
      device: { os: String(peer.device.os).slice(0, 20), browser: String(peer.device.browser).slice(0, 20), type: peer.device.type },
    }
    const others = [...this.members.values()]
    this.members.set(ws, sanitized)
    this.send(ws, { t: 'joined', room: this.id, kind: this.kind, you: sanitized.id, peers: others })
    this.broadcast({ t: 'peer-joined', peer: sanitized }, ws)
    this.opts.audit?.({ ev: 'join', room: this.auditId, kind: this.kind, peers: this.members.size, ts: Date.now() })
    return true
  }

  leave(ws: SocketLike): void {
    const peer = this.members.get(ws)
    if (!peer) return
    this.members.delete(ws)
    this.broadcast({ t: 'peer-left', id: peer.id })
    this.opts.audit?.({ ev: 'leave', room: this.auditId, peers: this.members.size, ts: Date.now() })
  }

  private broadcast(msg: ServerSignalMsg, except?: SocketLike) {
    for (const sock of this.members.keys()) if (sock !== except) this.send(sock, msg)
  }

  private send(ws: SocketLike, msg: ServerSignalMsg) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* socket gone; leave() will follow */
    }
  }

  private error(ws: SocketLike, message: string) {
    this.send(ws, { t: 'error', message })
  }
}

export function isValidPeer(p: unknown): p is PeerInfo {
  if (!p || typeof p !== 'object') return false
  const x = p as Record<string, unknown>
  const d = x.device as Record<string, unknown> | undefined
  return (
    typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 64 &&
    typeof x.deviceId === 'string' && x.deviceId.length <= 64 &&
    typeof x.name === 'string' &&
    !!d && typeof d.os === 'string' && typeof d.browser === 'string' &&
    (d.type === 'desktop' || d.type === 'mobile' || d.type === 'tablet')
  )
}

/** Room id for a request: explicit code room, else the "sabha" of its public IP. */
export async function roomIdFor(url: URL, ip: string): Promise<{ id: string; kind: RoomKind }> {
  const code = url.searchParams.get('room')?.trim().toLowerCase()
  if (code) {
    if (!/^[a-z0-9-]{3,40}$/.test(code)) throw new Error('invalid room code')
    return { id: `code:${code}`, kind: 'code' }
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`narad-sabha|${normalizeIp(ip)}`))
  const hex = Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
  return { id: `sabha:${hex}`, kind: 'sabha' }
}

export function normalizeIp(ip: string): string {
  let s = ip.trim()
  if (s.startsWith('::ffff:')) s = s.slice(7)
  if (s === '::1') s = '127.0.0.1'
  // IPv6: group by /64 so devices on one home/office prefix land in the same sabha.
  if (s.includes(':')) return s.split(':').slice(0, 4).join(':')
  return s
}

export function clientIp(headers: { get(name: string): string | null | undefined }, fallback: string): string {
  return headers.get('cf-connecting-ip') || headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || fallback
}
