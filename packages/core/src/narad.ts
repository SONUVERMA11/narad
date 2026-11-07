/**
 * Narad — the orchestrator the UI (web app, extension, desktop) talks to.
 * Owns identity, signaling rooms (sabha / codes / contacts / spaces), one
 * PeerConnection + TransferManager per peer, pairing and space membership.
 */
import { contacts as contactStore, nudgeToken, pairRoomId, type Contact } from './contacts'
import { Emitter } from './emitter'
import { getSetting, loadOrCreateIdentity, setSetting, type Identity } from './identity'
import { nameFor, randomId } from './names'
import { randomPairCode } from './pake'
import { runPairing } from './pairing'
import { PeerConnection, type PeerState } from './peer'
import type { DeviceInfo, PeerInfo, SignalData } from './protocol'
import { Signaling, type RoomStatus } from './signaling'
import { newSpace, spaceRoomId, spaces as spaceStore, type Space } from './spaces'
import { TransferManager, type ChatMessage, type IncomingDecision, type PausedEntry, type Transfer } from './transfer'

export interface NaradOptions {
  signalingUrl: string
  iceServers?: RTCIceServer[]
  /** HTTP(S) endpoint returning { iceServers } with server-minted TURN credentials. Default: derived from signalingUrl (/ice). */
  iceUrl?: string | false
  displayName?: string
  /** Join the same-network "sabha" room. Default true. */
  sabha?: boolean
  /** Team license token (ES256 JWT) presented to the signaling server on every join. */
  license?: string
}

export type RoomMeta =
  | { kind: 'sabha' }
  | { kind: 'code'; code: string }
  | { kind: 'contact'; deviceId: string }
  | { kind: 'space'; space: Space }
  | { kind: 'pair'; code: string }
  | { kind: 'share'; code: string }

export interface PeerVia {
  sabha: boolean
  codes: string[]
  /** Share code this peer came through (either side). */
  share?: string
  contact?: Contact
  spaces: Space[]
}

export interface PeerView {
  info: PeerInfo
  state: PeerState
  sas?: string[]
  route?: PeerConnection['route']
  emoji: string
  via: PeerVia
}

export interface ContactView extends Contact {
  /** Session ids of this contact's devices that are online right now. */
  online: string[]
  emoji: string
}

export interface SpaceView extends Space {
  roomKey: string
  status?: RoomStatus
  members: PeerInfo[]
}

export interface PairingHandle {
  code: string
  done: Promise<Contact>
  cancel: () => void
}

export interface ShareItems {
  files?: File[]
  paths?: (string | undefined)[]
  text?: string
}
export interface ShareHandle {
  code: string
  /** Stop handing out the items and leave the share room. Existing connections stay. */
  stop: () => void
}
/** How long a share code keeps serving new receivers. */
export const SHARE_TTL = 15 * 60_000

interface NaradEvents extends Record<string, unknown[]> {
  ready: [PeerInfo]
  peers: [PeerView[]]
  contacts: [ContactView[]]
  spaces: [SpaceView[]]
  room: [{ key: string; status: RoomStatus; meta?: RoomMeta }]
  transfer: [Transfer]
  incoming: [Transfer, IncomingDecision]
  message: [ChatMessage]
  /** Clipboard payload from a peer; `contact` is set when the sender is a known contact. */
  clip: [{ peerId: string; body: string; ts: number; contact?: Contact }]
  complete: [Transfer]
  'peer-secure': [string]
  error: [string]
  /** Share-by-code progress: a receiver joined and got the items, or the code expired/stopped. */
  share: [{ code: string; event: 'sent' | 'failed' | 'stopped'; peerId?: string; name?: string; reason?: string }]
}

export const DEFAULT_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }]
const PAIR_PREFIX = 'pair-'
const SHARE_PREFIX = 'share-'
/** How long a paused transfer waits for the other device to come back. */
export const RESUME_WINDOW = 10 * 60_000

export class Narad extends Emitter<NaradEvents> {
  me!: PeerInfo
  identity!: Identity
  private signaling!: Signaling
  private connections = new Map<string, PeerConnection>()
  private managers = new Map<string, TransferManager>()
  private roomMeta = new Map<string, RoomMeta>()
  private contactList: Contact[] = []
  private spaceList: Space[] = []
  private pushSubscription?: PushSubscriptionJSON
  private pushKey?: string | null
  /** Transfers frozen by a dropped connection, keyed by the remote deviceId, waiting for a reconnect. */
  private paused = new Map<string, { entries: PausedEntry[]; lastPeerId: string; timer: ReturnType<typeof setTimeout> }>()
  private iceServers: RTCIceServer[]
  private started = false
  /** Contacts negotiated (SPAKE2 on the share code) but not yet adopted; adopted when the receiver sends `contact-add`. */
  private shareCandidates = new Map<string, Promise<Contact>>()

  constructor(private readonly opts: NaradOptions) {
    super()
    this.iceServers = opts.iceServers ?? DEFAULT_ICE
  }

  async start(): Promise<PeerInfo> {
    if (this.started) return this.me
    this.started = true
    this.identity = await loadOrCreateIdentity()
    await this.loadIceConfig()
    const auto = nameFor(this.identity.deviceId)
    this.me = {
      id: `${this.identity.deviceId}:${randomId(4)}`,
      deviceId: this.identity.deviceId,
      name: this.opts.displayName || auto.name,
      device: detectDevice(),
    }
    this.signaling = new Signaling(this.opts.signalingUrl, this.me, this.opts.license ?? (await getSetting<string>('license')))
    this.signaling.on('peers', () => {
      this.emitPeers()
      this.emitContacts()
      this.emitSpaces()
      for (const deviceId of this.paused.keys()) this.tryReconnect(deviceId)
    })
    this.signaling.on('room', (r) => {
      this.emit('room', { ...r, meta: this.roomMeta.get(r.key) })
      this.emitSpaces()
    })
    this.signaling.on('signal', (from, data) => void this.onSignal(from, data))
    if (this.opts.sabha !== false) this.joinMeta('sabha', { kind: 'sabha' })
    this.contactList = await contactStore.list()
    for (const c of this.contactList) this.joinMeta(await pairRoomId(this.me.deviceId, c.deviceId, c.pairSecret), { kind: 'contact', deviceId: c.deviceId })
    this.spaceList = await spaceStore.list()
    for (const s of this.spaceList) this.joinMeta(await spaceRoomId(s), { kind: 'space', space: s })
    this.pushSubscription = await getSetting<PushSubscriptionJSON>('pushSubscription')
    this.emit('ready', this.me)
    this.emitContacts()
    this.emitSpaces()
    return this.me
  }

  /** Fetch ICE servers (STUN + short-lived TURN creds) from the signaling host; keep defaults on failure. */
  private async loadIceConfig() {
    if (this.opts.iceUrl === false || this.opts.iceServers) return
    const url = this.opts.iceUrl ?? iceUrlFromSignaling(this.opts.signalingUrl)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return
      const body = (await res.json()) as { iceServers?: RTCIceServer[] }
      if (Array.isArray(body.iceServers) && body.iceServers.length) this.iceServers = body.iceServers
    } catch {
      /* offline signaling host: STUN defaults */
    }
  }

  // ---- rooms ----

  joinRoom(code: string): void {
    const c = normalizeCode(code)
    this.joinMeta(c, { kind: 'code', code: c })
  }
  leaveRoom(code: string): void {
    this.leaveMeta(normalizeCode(code))
  }
  rooms(): { key: string; meta?: RoomMeta; status?: RoomStatus }[] {
    return this.signaling.joinedRooms().map((key) => ({ key, meta: this.roomMeta.get(key), status: this.signaling.roomStatus(key) }))
  }

  private joinMeta(key: string, meta: RoomMeta) {
    this.roomMeta.set(key, meta)
    this.signaling.join(key)
  }
  private leaveMeta(key: string) {
    this.signaling.leave(key)
    this.roomMeta.delete(key)
  }

  // ---- peers ----

  peers(): PeerView[] {
    return this.signaling.peers().map((info) => {
      const c = this.connections.get(info.id)
      return { info, state: c?.state ?? 'new', sas: c?.sas, route: c?.route, emoji: nameFor(info.deviceId).emoji, via: this.viaFor(info.id) }
    })
  }

  private viaFor(peerId: string): PeerVia {
    const via: PeerVia = { sabha: false, codes: [], spaces: [] }
    for (const key of this.signaling.roomsOf(peerId)) {
      const meta = this.roomMeta.get(key)
      if (!meta) continue
      if (meta.kind === 'sabha') via.sabha = true
      else if (meta.kind === 'code') via.codes.push(meta.code)
      else if (meta.kind === 'share') via.share = meta.code
      else if (meta.kind === 'space') via.spaces.push(meta.space)
      else if (meta.kind === 'contact') via.contact = this.contactList.find((c) => c.deviceId === meta.deviceId)
    }
    return via
  }

  /** Ensure a secure channel to a peer; resolves once E2E keys are derived. */
  async connect(peerId: string): Promise<TransferManager> {
    const existing = this.connections.get(peerId)
    if (existing && existing.state !== 'closed' && existing.state !== 'failed') {
      if (existing.isSecure) return this.managers.get(peerId)!
      return new Promise((resolve, reject) => {
        existing.once('secure', () => resolve(this.managers.get(peerId)!))
        existing.once('closed', () => reject(new Error('connection closed')))
      })
    }
    const remote = this.signaling.peer(peerId)
    if (!remote) throw new Error('peer not online')
    const conn = this.createConnection(remote)
    conn.initiate()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connection timeout')), 30_000)
      conn.once('secure', () => {
        clearTimeout(timer)
        resolve(this.managers.get(peerId)!)
      })
      conn.once('closed', () => {
        clearTimeout(timer)
        reject(new Error('connection closed'))
      })
    })
  }

  async sendFiles(peerId: string, files: File[], paths?: (string | undefined)[]): Promise<Transfer> {
    return (await this.connect(peerId)).sendFiles(files, paths)
  }
  async sendText(peerId: string, body: string): Promise<ChatMessage> {
    return (await this.connect(peerId)).sendText(body)
  }

  /** Push a clipboard change to every online contact that has clipboard sync on. */
  async broadcastClip(body: string): Promise<number> {
    let n = 0
    for (const c of this.contactList) {
      if (!c.syncClipboard) continue
      for (const p of this.signaling.peers().filter((x) => x.deviceId === c.deviceId)) {
        try {
          await (await this.connect(p.id)).sendClip(body)
          n++
        } catch {
          /* offline / failed: skip */
        }
      }
    }
    return n
  }

  /** True if any contact has clipboard sync on (so the UI knows whether to watch the clipboard). */
  clipboardSyncActive(): boolean {
    return this.contactList.some((c) => c.syncClipboard)
  }
  /** Group send: one file set to many peers, each over its own encrypted channel. */
  async sendFilesToMany(peerIds: string[], files: File[], paths?: (string | undefined)[]): Promise<PromiseSettledResult<Transfer>[]> {
    return Promise.allSettled(peerIds.map((id) => this.sendFiles(id, files, paths)))
  }
  async sendTextToMany(peerIds: string[], body: string): Promise<PromiseSettledResult<ChatMessage>[]> {
    return Promise.allSettled(peerIds.map((id) => this.sendText(id, body)))
  }

  cancel(peerId: string, transferId: string): void {
    this.managers.get(peerId)?.cancel(transferId)
  }
  manager(peerId: string): TransferManager | undefined {
    return this.managers.get(peerId)
  }
  disconnect(peerId: string): void {
    this.connections.get(peerId)?.close()
  }

  stop(): void {
    for (const c of this.connections.values()) c.close()
    this.signaling?.close()
  }

  // ---- contacts & pairing ----

  contacts(): ContactView[] {
    const peers = this.signaling.peers()
    return this.contactList.map((c) => ({
      ...c,
      emoji: nameFor(c.deviceId).emoji,
      online: peers.filter((p) => p.deviceId === c.deviceId).map((p) => p.id),
    }))
  }

  /** Show a code on this device (role A); the other device enters it. */
  startPairing(): PairingHandle {
    const code = randomPairCode()
    const key = PAIR_PREFIX + code
    this.joinMeta(key, { kind: 'pair', code })
    let cancelled = false
    const done = (async () => {
      try {
        const peerId = await this.waitForPeerIn(key, 120_000, () => cancelled)
        const conn = await this.waitForSecure(peerId, 30_000)
        const contact = await runPairing(conn, 'A', code, this.pairingSelf())
        await this.adoptContact(contact)
        return contact
      } finally {
        this.leaveMeta(key)
      }
    })()
    return { code, done, cancel: () => void (cancelled = true) }
  }

  /** Enter the code shown on the other device (role B). */
  async joinPairing(code: string): Promise<Contact> {
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) throw new Error('code must be 6 digits')
    const key = PAIR_PREFIX + clean
    this.joinMeta(key, { kind: 'pair', code: clean })
    try {
      const peerId = await this.waitForPeerIn(key, 30_000)
      await this.connect(peerId)
      const conn = this.connections.get(peerId)!
      const contact = await runPairing(conn, 'B', clean, this.pairingSelf())
      await this.adoptContact(contact)
      return contact
    } finally {
      this.leaveMeta(key)
    }
  }

  // ---- share by code: one 6-digit code, anyone who types it gets the items ----

  /**
   * Hand `items` to every device that enters `code` within SHARE_TTL. Each receiver gets its own encrypted
   * channel; SPAKE2 on the code also runs so either side can later turn the session into a contact.
   */
  startShare(items: ShareItems): ShareHandle {
    const code = randomPairCode()
    const key = SHARE_PREFIX + code
    this.joinMeta(key, { kind: 'share', code })
    const served = new Set<string>()
    let stopped = false
    const serve = async (peerId: string) => {
      if (served.has(peerId) || stopped) return
      served.add(peerId)
      const remote = this.signaling.peer(peerId)
      try {
        const tm = await this.connect(peerId)
        this.sharePairing(peerId, 'A', code)
        if (items.text?.trim()) await tm.sendText(items.text)
        if (items.files?.length) await tm.sendFiles(items.files, items.paths)
        this.emit('share', { code, event: 'sent', peerId, name: remote?.name })
      } catch (err) {
        served.delete(peerId)
        this.emit('share', { code, event: 'failed', peerId, name: remote?.name, reason: (err as Error).message })
      }
    }
    const check = () => {
      for (const p of this.signaling.peers()) if (this.signaling.roomsOf(p.id).includes(key)) void serve(p.id)
    }
    const off = this.signaling.on('peers', check)
    const stop = (reason: 'stopped' | 'expired' = 'stopped') => {
      if (stopped) return
      stopped = true
      off()
      clearTimeout(timer)
      this.leaveMeta(key)
      this.emit('share', { code, event: 'stopped', reason })
    }
    const timer = setTimeout(() => stop('expired'), SHARE_TTL)
    check()
    return { code, stop: () => stop() }
  }

  /** Enter a share code; resolves with the sender's session id once the encrypted channel is up. Items then arrive as usual. */
  async joinShare(code: string): Promise<string> {
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) throw new Error('code must be 6 digits')
    const key = SHARE_PREFIX + clean
    this.joinMeta(key, { kind: 'share', code: clean })
    try {
      const peerId = await this.waitForPeerIn(key, 60_000)
      await this.connect(peerId)
      this.sharePairing(peerId, 'B', clean)
      return peerId
    } catch (err) {
      this.leaveMeta(key)
      throw err
    }
  }

  /** Leave a share room (receiver side) without dropping the connection that already exists. */
  leaveShare(code: string): void {
    this.leaveMeta(SHARE_PREFIX + code.replace(/\D/g, ''))
  }

  /** Keep the device behind a share session as a contact (works from either side; the other side adopts too). */
  async addShareContact(peerId: string): Promise<Contact> {
    const pending = this.shareCandidates.get(peerId)
    if (!pending) throw new Error('no share session with this device')
    const contact = await pending
    await this.connections.get(peerId)?.sendControl({ t: 'contact-add' })
    await this.adoptContact(contact)
    return contact
  }

  private sharePairing(peerId: string, role: 'A' | 'B', code: string) {
    const conn = this.connections.get(peerId)
    if (!conn || this.shareCandidates.has(peerId)) return
    const pending = runPairing(conn, role, code, this.pairingSelf(), SHARE_TTL)
    pending.catch(() => this.shareCandidates.delete(peerId))
    this.shareCandidates.set(peerId, pending)
    const off = conn.on('control', (msg) => {
      if (msg.t !== 'contact-add') return
      off()
      void pending.then((c) => this.adoptContact(c)).catch(() => {})
    })
    conn.once('closed', () => this.shareCandidates.delete(peerId))
  }

  async removeContact(deviceId: string): Promise<void> {
    const c = this.contactList.find((x) => x.deviceId === deviceId)
    if (!c) return
    this.leaveMeta(await pairRoomId(this.me.deviceId, c.deviceId, c.pairSecret))
    if (this.pushSubscription) void this.pushPost('/push/unsubscribe', { token: await nudgeToken(c.pairSecret, this.me.deviceId) })
    await contactStore.remove(deviceId)
    this.contactList = this.contactList.filter((x) => x.deviceId !== deviceId)
    this.emitContacts()
    this.emitPeers()
  }

  async updateContact(deviceId: string, patch: Partial<Pick<Contact, 'name' | 'autoAccept' | 'syncClipboard'>>): Promise<void> {
    const c = this.contactList.find((x) => x.deviceId === deviceId)
    if (!c) return
    Object.assign(c, patch)
    this.emitContacts()
    this.emitPeers()
    await contactStore.save(c)
  }

  private pairingSelf() {
    return { deviceId: this.me.deviceId, name: this.me.name, identityPub: this.identity.publicKeyB64 }
  }

  private async adoptContact(contact: Contact) {
    const existing = this.contactList.find((c) => c.deviceId === contact.deviceId)
    if (existing) this.leaveMeta(await pairRoomId(this.me.deviceId, existing.deviceId, existing.pairSecret))
    this.contactList = [...this.contactList.filter((c) => c.deviceId !== contact.deviceId), contact]
    await contactStore.save(contact)
    this.joinMeta(await pairRoomId(this.me.deviceId, contact.deviceId, contact.pairSecret), { kind: 'contact', deviceId: contact.deviceId })
    this.emitContacts()
    this.emitPeers()
    void this.pushSubscribeFor(contact)
  }

  private waitForPeerIn(roomKey: string, timeoutMs: number, isCancelled: () => boolean = () => false): Promise<string> {
    const find = () => this.signaling.peers().find((p) => this.signaling.roomsOf(p.id).includes(roomKey))?.id
    const now = find()
    if (now) return Promise.resolve(now)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off()
        reject(new Error('nobody joined with this code'))
      }, timeoutMs)
      const off = this.signaling.on('peers', () => {
        if (isCancelled()) {
          clearTimeout(timer)
          off()
          return reject(new Error('cancelled'))
        }
        const id = find()
        if (id) {
          clearTimeout(timer)
          off()
          resolve(id)
        }
      })
    })
  }

  /** Wait for the other side to open a secure channel to us (used by the code-showing side). */
  private waitForSecure(peerId: string, timeoutMs: number): Promise<PeerConnection> {
    const existing = this.connections.get(peerId)
    if (existing?.isSecure) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off()
        reject(new Error('other device did not connect'))
      }, timeoutMs)
      const off = this.on('peer-secure', (id) => {
        if (id !== peerId) return
        clearTimeout(timer)
        off()
        resolve(this.connections.get(peerId)!)
      })
    })
  }

  // ---- spaces ----

  spaces(): SpaceView[] {
    const peers = this.signaling.peers()
    return this.spaceList.map((s) => {
      const roomKey = [...this.roomMeta.entries()].find(([, m]) => m.kind === 'space' && m.space.secret === s.secret)?.[0] ?? ''
      return { ...s, roomKey, status: this.signaling.roomStatus(roomKey), members: peers.filter((p) => this.signaling.roomsOf(p.id).includes(roomKey)) }
    })
  }

  async createSpace(name: string): Promise<Space> {
    return this.joinSpace(newSpace(name))
  }

  async joinSpace(input: Pick<Space, 'name' | 'secret'>): Promise<Space> {
    const existing = this.spaceList.find((s) => s.secret === input.secret)
    if (existing) return existing
    const space: Space = { name: input.name, secret: input.secret, joinedAt: Date.now() }
    this.spaceList = [...this.spaceList, space]
    await spaceStore.save(space)
    this.joinMeta(await spaceRoomId(space), { kind: 'space', space })
    this.emitSpaces()
    return space
  }

  async leaveSpace(secret: string): Promise<void> {
    const s = this.spaceList.find((x) => x.secret === secret)
    if (!s) return
    this.leaveMeta(await spaceRoomId(s))
    await spaceStore.remove(s)
    this.spaceList = this.spaceList.filter((x) => x.secret !== secret)
    this.emitSpaces()
    this.emitPeers()
  }

  // ---- internals ----

  private createConnection(remote: PeerInfo): PeerConnection {
    const conn = new PeerConnection({
      me: this.me,
      remote,
      iceServers: this.iceServers,
      sendSignal: (data) => this.signaling.signal(remote.id, data),
    })
    const tm = new TransferManager(conn, remote.id)
    this.connections.set(remote.id, conn)
    this.managers.set(remote.id, tm)
    conn.on('state', () => this.emitPeers())
    conn.on('secure', () => {
      this.emit('peer-secure', remote.id)
      const p = this.paused.get(remote.deviceId)
      if (p) {
        clearTimeout(p.timer)
        this.paused.delete(remote.deviceId)
        tm.adopt(p.entries)
      }
    })
    conn.on('closed', () => {
      if (this.connections.get(remote.id) === conn) {
        this.connections.delete(remote.id)
        this.managers.delete(remote.id)
      }
      this.emitPeers()
      if (this.paused.has(remote.deviceId)) setTimeout(() => this.tryReconnect(remote.deviceId), 1500)
    })
    tm.on('paused', (entries) => this.onPaused(remote, entries))
    tm.on('update', (t) => this.emit('transfer', t))
    tm.on('incoming', (t, d) => this.emit('incoming', t, d))
    tm.on('message', (m) => this.emit('message', m))
    tm.on('clip', ({ body, ts }) => this.emit('clip', { peerId: remote.id, body, ts, contact: this.contactList.find((c) => c.deviceId === remote.deviceId) }))
    tm.on('complete', (t) => this.emit('complete', t))
    return conn
  }

  /** Store a Team license on this device; used from the next (re)connect on. */
  async setLicense(token: string | undefined): Promise<void> {
    await setSetting('license', token)
    this.signaling.license = token
  }

  // ---- push nudge (opt-in; the server keeps only an opaque subscription per contact pair) ----

  private pushBase(): string {
    return iceUrlFromSignaling(this.opts.signalingUrl).replace(/\/ice$/, '')
  }

  /** VAPID public key if the signaling host has push enabled; null otherwise. */
  async pushPublicKey(): Promise<string | null> {
    if (this.pushKey !== undefined) return this.pushKey
    try {
      const res = await fetch(`${this.pushBase()}/push/key`)
      this.pushKey = res.ok ? ((await res.json()) as { publicKey: string }).publicKey : null
    } catch {
      this.pushKey = null
    }
    return this.pushKey
  }

  pushEnabled(): boolean {
    return !!this.pushSubscription
  }

  /** File this device's push subscription under every contact's nudge token. */
  async registerPush(sub: PushSubscriptionJSON): Promise<void> {
    this.pushSubscription = sub
    await setSetting('pushSubscription', sub)
    await Promise.all(this.contactList.map((c) => this.pushSubscribeFor(c)))
  }

  async unregisterPush(): Promise<void> {
    const subs = this.contactList.map(async (c) => this.pushPost('/push/unsubscribe', { token: await nudgeToken(c.pairSecret, this.me.deviceId) }))
    await Promise.all(subs)
    this.pushSubscription = undefined
    await setSetting('pushSubscription', undefined)
  }

  /** Ask the push service to wake a contact's device: "someone wants to reach you". */
  async nudge(deviceId: string): Promise<'sent' | 'no-subscription' | 'too-soon' | 'failed'> {
    const c = this.contactList.find((x) => x.deviceId === deviceId)
    if (!c) return 'failed'
    const status = await this.pushPost('/push/nudge', { token: await nudgeToken(c.pairSecret, c.deviceId) })
    return status === 202 ? 'sent' : status === 404 || status === 410 ? 'no-subscription' : status === 429 ? 'too-soon' : 'failed'
  }

  private async pushSubscribeFor(c: Contact) {
    if (!this.pushSubscription) return
    await this.pushPost('/push/subscribe', { token: await nudgeToken(c.pairSecret, this.me.deviceId), subscription: this.pushSubscription })
  }

  private async pushPost(path: string, body: unknown): Promise<number> {
    try {
      const res = await fetch(`${this.pushBase()}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      return res.status
    } catch {
      return 0
    }
  }

  // ---- resume: keep frozen transfers for a while and reconnect to the same device ----

  private onPaused(remote: PeerInfo, entries: PausedEntry[]) {
    const prev = this.paused.get(remote.deviceId)
    if (prev) clearTimeout(prev.timer)
    const all = [...(prev?.entries ?? []), ...entries]
    const timer = setTimeout(() => this.expirePaused(remote.deviceId), RESUME_WINDOW)
    this.paused.set(remote.deviceId, { entries: all, lastPeerId: remote.id, timer })
    setTimeout(() => this.tryReconnect(remote.deviceId), 1000)
  }

  private tryReconnect(deviceId: string) {
    const p = this.paused.get(deviceId)
    if (!p) return
    if (!p.entries.some((e) => e.transfer.status === 'paused')) {
      clearTimeout(p.timer)
      this.paused.delete(deviceId)
      return
    }
    const peer = this.signaling.peers().find((x) => x.deviceId === deviceId)
    if (!peer) return
    const conn = this.connections.get(peer.id)
    if (conn && conn.state !== 'closed' && conn.state !== 'failed') return
    // Exactly one side initiates: the impolite one, or whoever still holds state if the other device reloaded.
    const impolite = this.me.id > peer.id
    const peerReloaded = peer.id !== p.lastPeerId
    if (!impolite && !peerReloaded) return
    this.connect(peer.id).catch(() => {})
  }

  private expirePaused(deviceId: string) {
    const p = this.paused.get(deviceId)
    if (!p) return
    this.paused.delete(deviceId)
    for (const e of p.entries) {
      if (e.transfer.status !== 'paused') continue
      e.transfer.status = 'error'
      e.transfer.error = 'could not reconnect'
      e.transfer.finishedAt = Date.now()
      void e.recv?.chain.then(() => e.recv?.sink?.abort()).catch(() => {})
      this.emit('transfer', e.transfer)
    }
  }

  private async onSignal(from: string, data: SignalData) {
    let conn = this.connections.get(from)
    if (!conn || conn.state === 'closed' || conn.state === 'failed') {
      const remote = this.signaling.peer(from)
      if (!remote) return
      conn = this.createConnection(remote)
    }
    await conn.handleSignal(data)
  }

  private emitPeers() {
    this.emit('peers', this.peers())
  }
  private emitContacts() {
    this.emit('contacts', this.contacts())
  }
  private emitSpaces() {
    this.emit('spaces', this.spaces())
  }
}

export function iceUrlFromSignaling(signalingUrl: string): string {
  const u = new URL(signalingUrl)
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'
  u.pathname = '/ice'
  u.search = ''
  return u.toString()
}

export function normalizeCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, '-')
}

export function detectDevice(): DeviceInfo {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Mac/i.test(ua) ? 'macOS' : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : 'Unknown'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const type = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop'
  return { os, browser, type }
}
