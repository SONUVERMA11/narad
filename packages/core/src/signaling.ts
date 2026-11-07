/**
 * Sanjay — presence & signaling client. One WebSocket per room.
 * Rooms: the implicit "sabha" (same public network) and optional code rooms.
 */
import { Emitter } from './emitter'
import type { ClientSignalMsg, PeerInfo, RoomKind, ServerSignalMsg, SignalData } from './protocol'

/** How long a fresh socket may wait for the server's `joined` ack before reconnecting. */
const JOIN_ACK_TIMEOUT = 5_000

export type RoomStatus = 'connecting' | 'open' | 'closed'

interface RoomEvents extends Record<string, unknown[]> {
  joined: [{ room: string; kind: RoomKind; peers: PeerInfo[] }]
  'peer-joined': [PeerInfo]
  'peer-left': [string]
  signal: [string, SignalData]
  status: [RoomStatus]
}

export class RoomConnection extends Emitter<RoomEvents> {
  private ws?: WebSocket
  private closed = false
  private attempt = 0
  private pingTimer?: ReturnType<typeof setInterval>
  private joinTimer?: ReturnType<typeof setTimeout>
  status: RoomStatus = 'connecting'

  constructor(
    readonly url: string,
    private readonly me: PeerInfo,
    private readonly license?: string,
  ) {
    super()
  }

  connect(): void {
    if (this.closed) return
    this.setStatus('connecting')
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.attempt = 0
      this.send({ t: 'join', peer: this.me, license: this.license })
      this.setStatus('open')
      this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 25_000)
      // No `joined` ack in time → the server lost our join (restart, room race); reconnect rather than sit in limbo.
      this.joinTimer = setTimeout(() => ws.close(), JOIN_ACK_TIMEOUT)
    }
    ws.onmessage = (ev) => {
      let msg: ServerSignalMsg
      try {
        msg = JSON.parse(String(ev.data)) as ServerSignalMsg
      } catch {
        return
      }
      switch (msg.t) {
        case 'joined':
          if (this.joinTimer) clearTimeout(this.joinTimer)
          this.emit('joined', { room: msg.room, kind: msg.kind, peers: msg.peers })
          break
        case 'peer-joined':
          this.emit('peer-joined', msg.peer)
          break
        case 'peer-left':
          this.emit('peer-left', msg.id)
          break
        case 'signal':
          this.emit('signal', msg.from, msg.data)
          break
        case 'error':
          console.warn('[narad/signaling]', msg.message)
          break
      }
    }
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer)
      if (this.joinTimer) clearTimeout(this.joinTimer)
      this.setStatus('closed')
      if (!this.closed) {
        const delay = Math.min(30_000, 500 * 2 ** this.attempt++) + Math.random() * 300
        setTimeout(() => this.connect(), delay)
      }
    }
    ws.onerror = () => {
      /* onclose follows */
    }
  }

  send(msg: ClientSignalMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  close(): void {
    this.closed = true
    if (this.pingTimer) clearInterval(this.pingTimer)
    if (this.joinTimer) clearTimeout(this.joinTimer)
    this.ws?.close()
  }

  private setStatus(s: RoomStatus) {
    this.status = s
    this.emit('status', s)
  }
}

interface SignalingEvents extends Record<string, unknown[]> {
  peers: [PeerInfo[]]
  signal: [string, SignalData]
  room: [{ key: string; status: RoomStatus; name?: string }]
}

export class Signaling extends Emitter<SignalingEvents> {
  private rooms = new Map<string, RoomConnection>()
  private membership = new Map<string, { peer: PeerInfo; rooms: Set<string> }>()

  constructor(
    private readonly baseUrl: string,
    private readonly me: PeerInfo,
    public license?: string,
  ) {
    super()
  }

  /** key: 'sabha' for the implicit same-network room, otherwise a room code. */
  join(key: string): void {
    if (this.rooms.has(key)) return
    const url = new URL(this.baseUrl)
    if (key !== 'sabha') url.searchParams.set('room', key)
    const rc = new RoomConnection(url.toString(), this.me, this.license)
    this.rooms.set(key, rc)
    rc.on('status', (status) => {
      this.emit('room', { key, status })
      if (status === 'closed') this.dropRoom(key)
    })
    rc.on('joined', ({ peers }) => {
      this.dropRoom(key)
      for (const p of peers) this.addPeer(p, key)
      this.emitPeers()
    })
    rc.on('peer-joined', (p) => {
      this.addPeer(p, key)
      this.emitPeers()
    })
    rc.on('peer-left', (id) => {
      this.removePeer(id, key)
      this.emitPeers()
    })
    rc.on('signal', (from, data) => this.emit('signal', from, data))
    rc.connect()
  }

  leave(key: string): void {
    const rc = this.rooms.get(key)
    if (!rc) return
    rc.close()
    this.rooms.delete(key)
    this.dropRoom(key)
    this.emitPeers()
    this.emit('room', { key, status: 'closed' })
  }

  joinedRooms(): string[] {
    return [...this.rooms.keys()]
  }

  peer(id: string): PeerInfo | undefined {
    return this.membership.get(id)?.peer
  }

  peers(): PeerInfo[] {
    return [...this.membership.values()].map((m) => m.peer)
  }

  roomsOf(id: string): string[] {
    return [...(this.membership.get(id)?.rooms ?? [])]
  }

  roomStatus(key: string): RoomStatus | undefined {
    return this.rooms.get(key)?.status
  }

  signal(to: string, data: SignalData): void {
    const m = this.membership.get(to)
    const key = m ? [...m.rooms][0] : undefined
    const rc = key ? this.rooms.get(key) : undefined
    if (!rc) {
      console.warn('[narad/signaling] no route to peer', to)
      return
    }
    rc.send({ t: 'signal', to, data })
  }

  close(): void {
    for (const rc of this.rooms.values()) rc.close()
    this.rooms.clear()
    this.membership.clear()
  }

  private addPeer(p: PeerInfo, room: string) {
    if (p.id === this.me.id) return
    const m = this.membership.get(p.id)
    if (m) {
      m.peer = p
      m.rooms.add(room)
    } else this.membership.set(p.id, { peer: p, rooms: new Set([room]) })
  }

  private removePeer(id: string, room: string) {
    const m = this.membership.get(id)
    if (!m) return
    m.rooms.delete(room)
    if (m.rooms.size === 0) this.membership.delete(id)
  }

  private dropRoom(room: string) {
    for (const [id, m] of this.membership) {
      m.rooms.delete(room)
      if (m.rooms.size === 0) this.membership.delete(id)
    }
  }

  private emitPeers() {
    this.emit('peers', this.peers())
  }
}
