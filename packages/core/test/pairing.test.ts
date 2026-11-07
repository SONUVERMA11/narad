import { describe, expect, it } from 'vitest'
import { Emitter } from '../src/emitter'
import { runPairing } from '../src/pairing'
import type { PeerConnection } from '../src/peer'
import type { ControlMsg } from '../src/protocol'

/** Two fake channels wired back-to-back. `fingerprint` can differ to simulate a MITM. */
function fakePair(fpA: string, fpB = fpA) {
  class Fake extends Emitter<{ control: [ControlMsg]; closed: [] }> {
    other!: Fake
    constructor(public fingerprint: string) {
      super()
    }
    async sendControl(msg: ControlMsg) {
      const o = this.other
      queueMicrotask(() => o.emit('control', msg))
    }
  }
  const a = new Fake(fpA)
  const b = new Fake(fpB)
  a.other = b
  b.other = a
  return [a as unknown as PeerConnection, b as unknown as PeerConnection] as const
}
const me = (id: string) => ({ deviceId: id, name: `Device ${id}`, identityPub: `pub-${id}` })

describe('runPairing', () => {
  it('pairs two devices with the same code and derives the same pair secret', async () => {
    const [a, b] = fakePair('fp')
    const [ca, cb] = await Promise.all([runPairing(a, 'A', '123456', me('aaaa')), runPairing(b, 'B', '123456', me('bbbb'))])
    expect(ca.deviceId).toBe('bbbb')
    expect(cb.deviceId).toBe('aaaa')
    expect(ca.pairSecret).toBe(cb.pairSecret)
    expect(ca.identityPub).toBe('pub-bbbb')
  })

  it('rejects a wrong code on both sides without leaking anything', async () => {
    const [a, b] = fakePair('fp')
    const results = await Promise.allSettled([runPairing(a, 'A', '123456', me('a'), 2000), runPairing(b, 'B', '654321', me('b'), 2000)])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(results.map((r) => (r as PromiseRejectedResult).reason.message).join(' ')).toMatch(/wrong code/)
  })

  it('rejects when the channel fingerprints differ (MITM relay)', async () => {
    const [a, b] = fakePair('fp-seen-by-a', 'fp-seen-by-b')
    const results = await Promise.allSettled([runPairing(a, 'A', '123456', me('a'), 2000), runPairing(b, 'B', '123456', me('b'), 2000)])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
  })

  it('rejects when both sides pick the same role', async () => {
    const [a, b] = fakePair('fp')
    const results = await Promise.allSettled([runPairing(a, 'A', '1', me('a'), 2000), runPairing(b, 'A', '1', me('b'), 2000)])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
  })
})
