import { describe, expect, it } from 'vitest'
import { Emitter } from '../src/emitter'
import type { PeerConnection } from '../src/peer'
import type { ControlMsg } from '../src/protocol'
import { MemorySink, TransferManager, type PausedEntry } from '../src/transfer'

/** In-memory stand-in for a PeerConnection pair. `dropAfterChunks` simulates a dropped connection. */
class FakeConn extends Emitter<{ control: [ControlMsg]; chunk: [Uint8Array]; closed: [] }> {
  other!: FakeConn
  alive = true
  chunksSent = 0
  bytesSent = 0
  constructor(private readonly dropAfterChunks = Infinity) {
    super()
  }
  async sendControl(msg: ControlMsg) {
    if (!this.alive) throw new Error('channel closed')
    const o = this.other
    setTimeout(() => o.emit('control', msg), 0) // in flight: still delivered after a drop
  }
  async sendChunk(plain: Uint8Array) {
    if (!this.alive) throw new Error('channel closed')
    this.chunksSent++
    this.bytesSent += plain.length
    if (this.chunksSent > this.dropAfterChunks) {
      this.drop()
      throw new Error('channel closed')
    }
    const copy = plain.slice()
    const o = this.other
    setTimeout(() => o.emit('chunk', copy), 0)
  }
  async waitForDrain() {}
  drop() {
    if (!this.alive) return
    this.alive = false
    this.other.alive = false
    setTimeout(() => {
      this.emit('closed')
      this.other.emit('closed')
    }, 0)
  }
}
function link(dropAfter?: number) {
  const a = new FakeConn(dropAfter)
  const b = new FakeConn()
  a.other = b
  b.other = a
  return [a as unknown as PeerConnection & FakeConn, b as unknown as PeerConnection & FakeConn] as const
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const until = <T>(em: { once: (ev: any, fn: (...a: any[]) => void) => unknown }, ev: string) => new Promise<T>((r) => em.once(ev, (x: T) => r(x)))

function randomFile(size: number, name: string) {
  const data = new Uint8Array(size)
  for (let i = 0; i < size; i += 65536) crypto.getRandomValues(data.subarray(i, Math.min(size, i + 65536)))
  return { file: new File([data], name), data }
}

describe('resume after a dropped connection', () => {
  it('continues from the last byte the receiver got, and the file is intact', async () => {
    const { file, data } = randomFile(600_000, 'big.bin') // ~10 chunks
    const [a1, b1] = link(4) // drop after 4 chunks
    const sender1 = new TransferManager(a1, 'b:1')
    const receiver1 = new TransferManager(b1, 'a:1')
    let blob: Blob | undefined
    receiver1.on('incoming', (_t, d) => d.accept(async (meta) => new MemorySink(meta, (b) => (blob = b))))
    const pausedA = until<PausedEntry[]>(sender1, 'paused')
    const pausedB = until<PausedEntry[]>(receiver1, 'paused')
    const t = sender1.sendFiles([file])
    const [ea, eb] = await Promise.all([pausedA, pausedB])
    expect(t.status).toBe('paused')
    expect(eb[0]!.transfer.status).toBe('paused')
    const receivedBeforeDrop = eb[0]!.recv!.received[0]!
    expect(receivedBeforeDrop).toBeGreaterThan(0)
    expect(receivedBeforeDrop).toBeLessThan(data.length)

    // New connection to the same device; both sides adopt their frozen state.
    const [a2, b2] = link()
    const sender2 = new TransferManager(a2, 'b:2')
    const receiver2 = new TransferManager(b2, 'a:2')
    const done = until(receiver2, 'complete')
    receiver2.adopt(eb)
    sender2.adopt(ea)
    await done
    expect(t.status).toBe('done')
    expect(t.resumed).toBe(1)
    expect(blob).toBeDefined()
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(data)
    // the second connection carried only the remainder (+ 8-byte headers), not the whole file again
    expect(a2.bytesSent).toBeLessThan(data.length - receivedBeforeDrop + 10 * 64)
  })

  it('fails cleanly when the receiver no longer has state', async () => {
    const { file } = randomFile(200_000, 'x.bin')
    const [a1, b1] = link(1)
    const sender1 = new TransferManager(a1, 'b:1')
    const receiver1 = new TransferManager(b1, 'a:1')
    receiver1.on('incoming', (_t, d) => d.accept(async (meta) => new MemorySink(meta, () => {})))
    const pausedA = until<PausedEntry[]>(sender1, 'paused')
    const t = sender1.sendFiles([file])
    const ea = await pausedA
    const [a2, b2] = link()
    const sender2 = new TransferManager(a2, 'b:2')
    new TransferManager(b2, 'a:2') // fresh receiver (e.g. page reloaded): nothing to adopt
    const updated = new Promise<void>((r) => sender2.on('update', (x) => x.status === 'error' && r()))
    sender2.adopt(ea)
    await updated
    expect(t.status).toBe('error')
    expect(t.error).toMatch(/receiver lost/)
  })
})
