/**
 * Pushpak — chunked, encrypted, back-pressured file & text transfer over one PeerConnection.
 * Nothing is buffered beyond one chunk on the sender; the receiver streams into a FileSink.
 * If the connection drops mid-transfer, state is handed back as "paused" and can be adopted
 * by the next TransferManager to the same device, which resumes from the last byte received.
 */
import { Emitter } from './emitter'
import type { PeerConnection } from './peer'
import { CHUNK_DATA, CHUNK_HEADER, type ControlMsg, type FileMeta } from './protocol'
import { randomId } from './names'

export type TransferStatus = 'pending' | 'active' | 'paused' | 'done' | 'rejected' | 'cancelled' | 'error'

export interface Transfer {
  id: string
  seq: number
  peerId: string
  direction: 'send' | 'receive'
  files: FileMeta[]
  bytesDone: number
  bytesTotal: number
  currentFile: number
  status: TransferStatus
  error?: string
  startedAt: number
  finishedAt?: number
  /** bytes/second, smoothed */
  speed: number
  resumed?: number
}

export interface FileSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
}

export type SinkFactory = (file: FileMeta, transfer: Transfer) => Promise<FileSink>

export interface IncomingDecision {
  accept: (sinks: SinkFactory) => void
  reject: () => void
}

export interface ChatMessage {
  id: string
  peerId: string
  direction: 'in' | 'out'
  body: string
  ts: number
}

/** A send or receive frozen by a dropped connection; adoptable by a new TransferManager to the same device. */
export interface PausedEntry {
  transfer: Transfer
  files?: File[]
  recv?: ReceiveState
}

interface TransferEvents extends Record<string, unknown[]> {
  update: [Transfer]
  incoming: [Transfer, IncomingDecision]
  message: [ChatMessage]
  clip: [{ body: string; ts: number }]
  complete: [Transfer]
  paused: [PausedEntry[]]
}

export interface ReceiveState {
  transfer: Transfer
  sinks: SinkFactory
  sink?: FileSink
  chain: Promise<void>
  /** bytes written per file index */
  received: number[]
}

const RESUME_TIMEOUT = 20_000

export class TransferManager extends Emitter<TransferEvents> {
  private seq = 0
  readonly transfers = new Map<string, Transfer>()
  private accepts = new Map<string, { resolve: (ok: boolean) => void }>()
  private receives = new Map<number, ReceiveState>()
  private sendFilesById = new Map<string, File[]>()
  private pausedRecv = new Map<string, ReceiveState>()
  private resumeWaiters = new Map<string, { resolve: (r: { fromFile: number; fromOffset: number } | undefined) => void }>()
  private cancelled = new Set<string>()
  private closed = false

  constructor(
    private readonly peer: PeerConnection,
    readonly peerId: string,
  ) {
    super()
    peer.on('control', (msg) => void this.handleControl(msg))
    peer.on('chunk', (bytes) => this.handleChunk(bytes))
    peer.on('closed', () => this.pauseAll())
  }

  async sendText(body: string): Promise<ChatMessage> {
    const msg: ChatMessage = { id: randomId(8), peerId: this.peerId, direction: 'out', body, ts: Date.now() }
    await this.peer.sendControl({ t: 'text', id: msg.id, body, ts: msg.ts })
    this.emit('message', msg)
    return msg
  }

  /** Clipboard sync payload: not a chat message, never shown in the thread. */
  async sendClip(body: string): Promise<void> {
    await this.peer.sendControl({ t: 'clip', body, ts: Date.now() })
  }

  sendFiles(files: File[], paths?: (string | undefined)[]): Transfer {
    const seq = this.nextSeq()
    const metas: FileMeta[] = files.map((f, index) => ({
      index,
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
      path: paths?.[index] || (f as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
    }))
    const transfer: Transfer = {
      id: randomId(8),
      seq,
      peerId: this.peerId,
      direction: 'send',
      files: metas,
      bytesDone: 0,
      bytesTotal: metas.reduce((a, f) => a + f.size, 0),
      currentFile: 0,
      status: 'pending',
      startedAt: Date.now(),
      speed: 0,
    }
    this.transfers.set(transfer.id, transfer)
    this.sendFilesById.set(transfer.id, files)
    this.emit('update', transfer)
    void this.runSend(transfer, files)
    return transfer
  }

  cancel(id: string, reason = 'cancelled'): void {
    const t = this.transfers.get(id)
    if (!t || t.status === 'done' || t.status === 'cancelled' || t.status === 'rejected') return
    this.cancelled.add(id)
    this.accepts.get(id)?.resolve(false)
    this.resumeWaiters.get(id)?.resolve(undefined)
    if (!this.closed) void this.peer.sendControl({ t: 'cancel', id, reason }).catch(() => {})
    this.finish(t, 'cancelled', reason)
    const rs = this.receives.get(t.seq) ?? this.pausedRecv.get(id)
    if (rs) {
      this.receives.delete(t.seq)
      this.pausedRecv.delete(id)
      void rs.chain.then(() => rs.sink?.abort()).catch(() => {})
    }
  }

  /** Take over transfers frozen by a previous connection to the same device. */
  adopt(entries: PausedEntry[]): void {
    for (const e of entries) {
      const t = e.transfer
      if (t.status !== 'paused') continue
      t.peerId = this.peerId
      t.resumed = (t.resumed ?? 0) + 1
      this.transfers.set(t.id, t)
      this.emit('update', t)
      if (e.files) {
        this.sendFilesById.set(t.id, e.files)
        void this.resumeSend(t, e.files)
      } else if (e.recv) {
        this.pausedRecv.set(t.id, e.recv)
        setTimeout(() => {
          if (this.pausedRecv.delete(t.id) && t.status === 'paused') this.failReceive(e.recv!, 'sender lost the transfer')
        }, RESUME_TIMEOUT)
      }
    }
  }

  private nextSeq(): number {
    this.seq = (this.seq + 1) & 0xffff
    return this.seq
  }

  private async resumeSend(t: Transfer, files: File[]) {
    try {
      await this.peer.sendControl({ t: 'resume-offer', id: t.id })
      const where = await new Promise<{ fromFile: number; fromOffset: number } | undefined>((resolve) => {
        this.resumeWaiters.set(t.id, { resolve })
        setTimeout(() => resolve(undefined), RESUME_TIMEOUT)
      })
      this.resumeWaiters.delete(t.id)
      if (!where) {
        if (t.status === 'paused') this.finish(t, 'error', 'receiver lost the transfer')
        return
      }
      t.seq = this.nextSeq()
      await this.peer.sendControl({ t: 'resume-ack', id: t.id, seq: t.seq, ...where })
      t.bytesDone = t.files.slice(0, where.fromFile).reduce((a, f) => a + f.size, 0) + where.fromOffset
      await this.runSend(t, files, where.fromFile, where.fromOffset, true)
    } catch (err) {
      if (t.status === 'active' || t.status === 'paused') this.finish(t, 'error', (err as Error).message)
    }
  }

  private async runSend(t: Transfer, files: File[], fromFile = 0, fromOffset = 0, resuming = false) {
    try {
      if (!resuming) {
        await this.peer.sendControl({ t: 'offer-files', id: t.id, seq: t.seq, files: t.files })
        const ok = await new Promise<boolean>((resolve) => this.accepts.set(t.id, { resolve }))
        this.accepts.delete(t.id)
        if (!ok) {
          if (t.status === 'pending') this.finish(t, 'rejected')
          return
        }
      }
      t.status = 'active'
      t.startedAt = Date.now()
      this.emit('update', t)
      const header = new DataView(new ArrayBuffer(CHUNK_HEADER))
      let lastTick = Date.now()
      let lastBytes = t.bytesDone
      for (let i = fromFile; i < files.length; i++) {
        if (this.cancelled.has(t.id)) return
        t.currentFile = i
        const offset = i === fromFile ? fromOffset : 0
        if (offset === 0) await this.peer.sendControl({ t: 'file-start', id: t.id, index: i })
        let chunkIndex = Math.floor(offset / CHUNK_DATA)
        const source = offset ? files[i]!.slice(offset) : files[i]!
        for await (const data of chunkFile(source as File)) {
          if (this.cancelled.has(t.id)) return
          header.setUint16(0, t.seq)
          header.setUint16(2, i)
          header.setUint32(4, chunkIndex++)
          const plain = new Uint8Array(CHUNK_HEADER + data.length)
          plain.set(new Uint8Array(header.buffer), 0)
          plain.set(data, CHUNK_HEADER)
          await this.peer.sendChunk(plain)
          await this.peer.waitForDrain()
          t.bytesDone += data.length
          const now = Date.now()
          if (now - lastTick > 250) {
            const inst = ((t.bytesDone - lastBytes) * 1000) / (now - lastTick)
            t.speed = t.speed ? t.speed * 0.7 + inst * 0.3 : inst
            lastTick = now
            lastBytes = t.bytesDone
            this.emit('update', t)
          }
        }
        await this.peer.sendControl({ t: 'file-end', id: t.id, index: i })
      }
      await this.peer.sendControl({ t: 'done', id: t.id })
      this.sendFilesById.delete(t.id)
      this.finish(t, 'done')
      this.emit('complete', t)
    } catch (err) {
      // A dropped connection throws here a tick before 'closed' fires and pauseAll() flips the status
      // to 'paused'; give that a moment before declaring a genuine error.
      if (this.cancelled.has(t.id) || this.closed) return
      setTimeout(() => {
        if (t.status === 'active' && !this.closed) this.finish(t, 'error', (err as Error).message)
      }, 100)
    }
  }

  private async handleControl(msg: ControlMsg) {
    switch (msg.t) {
      case 'text':
        this.emit('message', { id: msg.id, peerId: this.peerId, direction: 'in', body: msg.body, ts: msg.ts })
        break
      case 'clip':
        this.emit('clip', { body: msg.body, ts: msg.ts })
        break
      case 'offer-files': {
        const transfer: Transfer = {
          id: msg.id,
          seq: msg.seq,
          peerId: this.peerId,
          direction: 'receive',
          files: msg.files,
          bytesDone: 0,
          bytesTotal: msg.files.reduce((a, f) => a + f.size, 0),
          currentFile: 0,
          status: 'pending',
          startedAt: Date.now(),
          speed: 0,
        }
        this.transfers.set(transfer.id, transfer)
        this.emit('update', transfer)
        const decision: IncomingDecision = {
          accept: (sinks) => {
            if (transfer.status !== 'pending') return
            transfer.status = 'active'
            transfer.startedAt = Date.now()
            this.receives.set(transfer.seq, { transfer, sinks, chain: Promise.resolve(), received: msg.files.map(() => 0) })
            this.emit('update', transfer)
            void this.peer.sendControl({ t: 'accept', id: transfer.id })
          },
          reject: () => {
            if (transfer.status !== 'pending') return
            this.finish(transfer, 'rejected')
            void this.peer.sendControl({ t: 'reject', id: transfer.id })
          },
        }
        this.emit('incoming', transfer, decision)
        break
      }
      case 'accept':
        this.accepts.get(msg.id)?.resolve(true)
        break
      case 'reject':
        this.accepts.get(msg.id)?.resolve(false)
        break
      case 'file-start': {
        const rs = this.receiveFor(msg.id)
        if (!rs) return
        rs.transfer.currentFile = msg.index
        const meta = rs.transfer.files[msg.index]!
        rs.chain = rs.chain.then(async () => {
          if (rs.sink) await rs.sink.abort().catch(() => {})
          rs.received[msg.index] = 0
          rs.sink = await rs.sinks(meta, rs.transfer)
        })
        rs.chain.catch((err) => this.failReceive(rs, (err as Error).message))
        break
      }
      case 'file-end': {
        const rs = this.receiveFor(msg.id)
        if (!rs) return
        rs.chain = rs.chain.then(async () => {
          await rs.sink?.close()
          rs.sink = undefined
        })
        rs.chain.catch((err) => this.failReceive(rs, (err as Error).message))
        break
      }
      case 'done': {
        const rs = this.receiveFor(msg.id)
        if (!rs) return
        rs.chain = rs.chain.then(() => {
          this.receives.delete(rs.transfer.seq)
          this.finish(rs.transfer, 'done')
          this.emit('complete', rs.transfer)
        })
        rs.chain.catch((err) => this.failReceive(rs, (err as Error).message))
        break
      }
      case 'cancel': {
        const t = this.transfers.get(msg.id)
        if (!t) return
        this.cancelled.add(t.id)
        this.accepts.get(t.id)?.resolve(false)
        this.resumeWaiters.get(t.id)?.resolve(undefined)
        const rs = this.receives.get(t.seq) ?? this.pausedRecv.get(t.id)
        if (rs) {
          this.receives.delete(t.seq)
          this.pausedRecv.delete(t.id)
          void rs.chain.then(() => rs.sink?.abort()).catch(() => {})
        }
        this.finish(t, 'cancelled', msg.reason)
        break
      }
      // ---- resume ----
      case 'resume-offer': {
        const rs = this.pausedRecv.get(msg.id)
        if (!rs) {
          await this.peer.sendControl({ t: 'resume-reject', id: msg.id })
          return
        }
        const fromFile = rs.received.findIndex((n, i) => n < rs.transfer.files[i]!.size || (rs.transfer.files[i]!.size === 0 && i >= rs.transfer.currentFile))
        const idx = fromFile === -1 ? rs.transfer.files.length : fromFile
        const fromOffset = rs.sink && idx === rs.transfer.currentFile ? (rs.received[idx] ?? 0) : 0
        await this.peer.sendControl({ t: 'resume-request', id: msg.id, fromFile: idx, fromOffset })
        break
      }
      case 'resume-request':
        this.resumeWaiters.get(msg.id)?.resolve({ fromFile: msg.fromFile, fromOffset: msg.fromOffset })
        break
      case 'resume-reject':
        this.resumeWaiters.get(msg.id)?.resolve(undefined)
        break
      case 'resume-ack': {
        const rs = this.pausedRecv.get(msg.id)
        if (!rs) return
        this.pausedRecv.delete(msg.id)
        rs.transfer.seq = msg.seq
        rs.transfer.status = 'active'
        rs.transfer.startedAt = Date.now()
        rs.transfer.bytesDone = rs.received.reduce((a, b) => a + b, 0)
        this.receives.set(msg.seq, rs)
        this.emit('update', rs.transfer)
        break
      }
    }
  }

  private handleChunk(bytes: Uint8Array) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const seq = view.getUint16(0)
    const fileIndex = view.getUint16(2)
    const rs = this.receives.get(seq)
    if (!rs) return
    const data = bytes.subarray(CHUNK_HEADER)
    rs.chain = rs.chain.then(() => rs.sink?.write(data))
    rs.chain.catch((err) => this.failReceive(rs, (err as Error).message))
    rs.received[fileIndex] = (rs.received[fileIndex] ?? 0) + data.length
    const t = rs.transfer
    t.bytesDone += data.length
    const elapsed = (Date.now() - t.startedAt) / 1000
    if (elapsed > 0) t.speed = rs.received.reduce((a, b) => a + b, 0) / Math.max(elapsed, 1) // conservative
    if (data.length === 0 || t.bytesDone % (CHUNK_DATA * 8) < data.length) this.emit('update', t)
  }

  private receiveFor(id: string): ReceiveState | undefined {
    const t = this.transfers.get(id)
    return t ? this.receives.get(t.seq) : undefined
  }

  private failReceive(rs: ReceiveState, reason: string) {
    if (rs.transfer.status !== 'active' && rs.transfer.status !== 'paused') return
    this.receives.delete(rs.transfer.seq)
    this.pausedRecv.delete(rs.transfer.id)
    if (!this.closed) void this.peer.sendControl({ t: 'cancel', id: rs.transfer.id, reason: 'receiver error' }).catch(() => {})
    void rs.chain.then(() => rs.sink?.abort()).catch(() => {})
    this.finish(rs.transfer, 'error', reason)
  }

  private finish(t: Transfer, status: TransferStatus, error?: string) {
    if (t.status === status) return
    t.status = status
    t.error = error
    t.finishedAt = Date.now()
    this.emit('update', t)
  }

  /** Connection dropped: freeze active transfers so a new connection can resume them. */
  private pauseAll() {
    this.closed = true
    const entries: PausedEntry[] = []
    for (const t of this.transfers.values()) {
      if (t.status === 'pending') {
        this.accepts.get(t.id)?.resolve(false)
        this.finish(t, 'error', 'connection closed')
      } else if (t.status === 'active' || t.status === 'paused') {
        t.status = 'paused'
        t.speed = 0
        this.emit('update', t)
        if (t.direction === 'send') entries.push({ transfer: t, files: this.sendFilesById.get(t.id) })
        else {
          const rs = this.receives.get(t.seq) ?? this.pausedRecv.get(t.id)
          if (rs) entries.push({ transfer: t, recv: rs })
        }
      }
    }
    for (const w of this.resumeWaiters.values()) w.resolve(undefined)
    this.receives.clear()
    this.pausedRecv.clear()
    if (entries.length) this.emit('paused', entries)
  }
}

/** Re-chunk a File's stream into fixed-size pieces without loading it in memory. */
export async function* chunkFile(file: File | Blob, size = CHUNK_DATA): AsyncGenerator<Uint8Array> {
  const reader = file.stream().getReader()
  let buf: Uint8Array = new Uint8Array(0)
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      let merged: Uint8Array
      if (buf.length === 0) merged = value as Uint8Array
      else {
        merged = new Uint8Array(buf.length + value.length)
        merged.set(buf, 0)
        merged.set(value, buf.length)
      }
      let offset = 0
      while (merged.length - offset >= size) {
        yield merged.subarray(offset, offset + size)
        offset += size
      }
      buf = merged.subarray(offset)
    }
    if (buf.length > 0) yield buf
    if (file.size === 0) yield new Uint8Array(0)
  } finally {
    reader.releaseLock()
  }
}

/** Receives everything in memory, then hands over a Blob. Fallback for browsers without File System Access. */
export class MemorySink implements FileSink {
  private parts: Uint8Array[] = []
  constructor(
    private readonly meta: FileMeta,
    private readonly onDone: (blob: Blob, meta: FileMeta) => void,
  ) {}
  async write(chunk: Uint8Array) {
    this.parts.push(chunk.slice())
  }
  async close() {
    this.onDone(new Blob(this.parts as BlobPart[], { type: this.meta.type || 'application/octet-stream' }), this.meta)
    this.parts = []
  }
  async abort() {
    this.parts = []
  }
}
