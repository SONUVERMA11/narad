/**
 * Setu — one WebRTC connection to one peer, with perfect negotiation,
 * LAN-first ICE and the Chakra E2E layer on top of the DataChannel.
 */
import { compareBytes, decryptBytes, decryptJson, deriveSharedKey, encryptBytes, encryptJson, fromBase64, generateSessionKeys, sasEmojis, sha256Hex, toBase64, type SessionKeys } from './crypto'
import { Emitter } from './emitter'
import { FRAME, type ControlMsg, type PeerInfo, type SignalData } from './protocol'

export type PeerState = 'new' | 'connecting' | 'connected' | 'secure' | 'disconnected' | 'failed' | 'closed'

interface PeerEvents extends Record<string, unknown[]> {
  state: [PeerState]
  secure: [string[]]
  control: [ControlMsg]
  chunk: [Uint8Array]
  closed: []
}

export interface PeerConnectionOptions {
  me: PeerInfo
  remote: PeerInfo
  iceServers: RTCIceServer[]
  sendSignal: (data: SignalData) => void
}

const HIGH_WATER = 4 * 1024 * 1024
const LOW_WATER = 1 * 1024 * 1024

export class PeerConnection extends Emitter<PeerEvents> {
  readonly pc: RTCPeerConnection
  private dc?: RTCDataChannel
  private keys?: SessionKeys
  private key?: CryptoKey
  private theirPub?: Uint8Array
  private polite: boolean
  private makingOffer = false
  private ignoreOffer = false
  private closedFlag = false
  private helloSent = false
  private earlyFrames: Uint8Array[] = []
  state: PeerState = 'new'
  sas?: string[]
  /** sha256 over both session public keys (sorted). Binds PAKE runs to this exact channel. */
  fingerprint?: string
  remoteName: string
  /** Set once the ICE pair is known; 'host' means LAN-direct. */
  route?: 'lan' | 'direct' | 'relay' | 'unknown'

  constructor(private readonly opts: PeerConnectionOptions) {
    super()
    this.remoteName = opts.remote.name
    this.polite = opts.me.id < opts.remote.id
    this.pc = new RTCPeerConnection({ iceServers: opts.iceServers })
    this.pc.onnegotiationneeded = () => void this.negotiate()
    this.pc.onicecandidate = ({ candidate }) =>
      opts.sendSignal({ kind: 'candidate', candidate: candidate ? candidate.toJSON() : null })
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState
      if (s === 'connected') {
        void this.detectRoute()
        if (this.state !== 'secure') this.setState('connected')
      } else if (s === 'disconnected') this.setState('disconnected')
      else if (s === 'failed') {
        this.setState('failed')
        this.close()
      } else if (s === 'closed') this.close()
    }
    this.pc.ondatachannel = ({ channel }) => this.attachChannel(channel)
  }

  /** Call once from the initiating side. The other side waits for `ondatachannel`. */
  initiate(): void {
    if (this.dc) return
    this.setState('connecting')
    this.attachChannel(this.pc.createDataChannel('narad', { ordered: true }))
  }

  async handleSignal(data: SignalData): Promise<void> {
    if (this.closedFlag) return
    try {
      if (data.kind === 'description') {
        const description = data.description as RTCSessionDescriptionInit
        const offerCollision = description.type === 'offer' && (this.makingOffer || this.pc.signalingState !== 'stable')
        this.ignoreOffer = !this.polite && offerCollision
        if (this.ignoreOffer) return
        await this.pc.setRemoteDescription(description)
        if (description.type === 'offer') {
          await this.pc.setLocalDescription()
          this.opts.sendSignal({ kind: 'description', description: this.pc.localDescription!.toJSON() })
        }
      } else if (data.kind === 'candidate') {
        try {
          await this.pc.addIceCandidate((data.candidate as RTCIceCandidateInit | null) ?? undefined)
        } catch (err) {
          if (!this.ignoreOffer) throw err
        }
      }
    } catch (err) {
      console.error('[narad/peer] signal error', err)
    }
  }

  private async negotiate() {
    try {
      this.makingOffer = true
      await this.pc.setLocalDescription()
      this.opts.sendSignal({ kind: 'description', description: this.pc.localDescription!.toJSON() })
    } catch (err) {
      console.error('[narad/peer] negotiate error', err)
    } finally {
      this.makingOffer = false
    }
  }

  private attachChannel(dc: RTCDataChannel) {
    this.dc = dc
    dc.binaryType = 'arraybuffer'
    dc.bufferedAmountLowThreshold = LOW_WATER
    dc.onopen = () => void this.sendHello()
    dc.onmessage = (ev) => void this.handleFrame(new Uint8Array(ev.data as ArrayBuffer))
    dc.onclose = () => this.close()
    dc.onerror = (ev) => console.warn('[narad/peer] channel error', ev)
    if (dc.readyState === 'open') void this.sendHello()
  }

  private async sendHello() {
    if (this.helloSent) return
    this.helloSent = true
    this.keys = await generateSessionKeys()
    const hello: ControlMsg = { t: 'hello', pub: toBase64(this.keys.publicRaw), name: this.opts.me.name, deviceId: this.opts.me.deviceId }
    const body = new TextEncoder().encode(JSON.stringify(hello))
    const frame = new Uint8Array(1 + body.length)
    frame[0] = FRAME.PLAIN_JSON
    frame.set(body, 1)
    this.dc!.send(frame)
    await this.maybeDeriveKey()
  }

  private async handleFrame(frame: Uint8Array) {
    const type = frame[0]
    const payload = frame.subarray(1)
    if (type === FRAME.PLAIN_JSON) {
      const msg = JSON.parse(new TextDecoder().decode(payload)) as ControlMsg
      if (msg.t === 'hello' && !this.theirPub) {
        this.theirPub = fromBase64(msg.pub)
        this.remoteName = msg.name
        await this.maybeDeriveKey()
      }
      return
    }
    if (!this.key) {
      // The peer derived its key a moment before us; hold the frame until ours is ready.
      if (this.earlyFrames.length < 64) this.earlyFrames.push(frame)
      return
    }
    if (type === FRAME.ENC_JSON) {
      this.emit('control', await decryptJson<ControlMsg>(this.key, payload))
    } else if (type === FRAME.ENC_CHUNK) {
      this.emit('chunk', await decryptBytes(this.key, payload))
    }
  }

  private async maybeDeriveKey() {
    if (this.key || !this.keys || !this.theirPub) return
    const salt = [this.opts.me.id, this.opts.remote.id].sort().join('|')
    this.key = await deriveSharedKey(this.keys, this.theirPub, salt)
    this.sas = await sasEmojis(this.keys.publicRaw, this.theirPub)
    const [p, q] = compareBytes(this.keys.publicRaw, this.theirPub) <= 0 ? [this.keys.publicRaw, this.theirPub] : [this.theirPub, this.keys.publicRaw]
    const both = new Uint8Array(p.length + q.length)
    both.set(p, 0)
    both.set(q, p.length)
    this.fingerprint = await sha256Hex(both)
    this.setState('secure')
    this.emit('secure', this.sas)
    const queued = this.earlyFrames.splice(0)
    for (const f of queued) await this.handleFrame(f)
  }

  get isSecure(): boolean {
    return !!this.key && this.dc?.readyState === 'open'
  }

  async sendControl(msg: ControlMsg): Promise<void> {
    if (!this.key || !this.dc || this.dc.readyState !== 'open') throw new Error('channel not secure')
    const ct = await encryptJson(this.key, msg)
    const frame = new Uint8Array(1 + ct.length)
    frame[0] = FRAME.ENC_JSON
    frame.set(ct, 1)
    this.dc.send(frame)
  }

  async sendChunk(plain: Uint8Array): Promise<void> {
    if (!this.key || !this.dc || this.dc.readyState !== 'open') throw new Error('channel not secure')
    const ct = await encryptBytes(this.key, plain)
    const frame = new Uint8Array(1 + ct.length)
    frame[0] = FRAME.ENC_CHUNK
    frame.set(ct, 1)
    this.dc.send(frame)
  }

  /** Backpressure: resolve when the channel's send buffer has drained below the low-water mark. */
  waitForDrain(): Promise<void> {
    const dc = this.dc
    if (!dc || dc.bufferedAmount < HIGH_WATER) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const onLow = () => {
        dc.removeEventListener('bufferedamountlow', onLow)
        dc.removeEventListener('close', onClose)
        resolve()
      }
      const onClose = () => {
        dc.removeEventListener('bufferedamountlow', onLow)
        reject(new Error('channel closed'))
      }
      dc.addEventListener('bufferedamountlow', onLow)
      dc.addEventListener('close', onClose)
    })
  }

  private async detectRoute() {
    try {
      const stats = await this.pc.getStats()
      let selected: RTCIceCandidatePairStats | undefined
      stats.forEach((s) => {
        if (s.type === 'candidate-pair' && (s as RTCIceCandidatePairStats).state === 'succeeded' && (s as RTCIceCandidatePairStats).nominated)
          selected = s as RTCIceCandidatePairStats
      })
      if (!selected) return
      const local = stats.get(selected.localCandidateId) as { candidateType?: string } | undefined
      const remote = stats.get(selected.remoteCandidateId) as { candidateType?: string } | undefined
      const lt = local?.candidateType
      const rt = remote?.candidateType
      if (lt === 'relay' || rt === 'relay') this.route = 'relay'
      else if (lt === 'host' && rt === 'host') this.route = 'lan'
      else if (lt || rt) this.route = 'direct'
      else this.route = 'unknown'
      this.emit('state', this.state)
    } catch {
      this.route = 'unknown'
    }
  }

  private setState(s: PeerState) {
    if (this.state === s) return
    this.state = s
    this.emit('state', s)
  }

  close(): void {
    if (this.closedFlag) return
    this.closedFlag = true
    try {
      this.dc?.close()
    } catch {
      /* noop */
    }
    try {
      this.pc.close()
    } catch {
      /* noop */
    }
    this.setState('closed')
    this.emit('closed')
    this.removeAll()
  }
}
