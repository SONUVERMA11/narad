import { describe, expect, it } from 'vitest'
import { constantTimeEqual, deriveFromPake, randomPairCode, Spake2 } from '../src/pake'

describe('SPAKE2 pairing', () => {
  it('agrees on a key when both sides know the code and context', () => {
    const a = new Spake2('A', '123456', 'fp-1')
    const b = new Spake2('B', '123456', 'fp-1')
    const ra = a.finish(b.message)
    const rb = b.finish(a.message)
    expect(ra.key).toEqual(rb.key)
    expect(constantTimeEqual(ra.myConfirm, rb.theirConfirm)).toBe(true)
    expect(constantTimeEqual(rb.myConfirm, ra.theirConfirm)).toBe(true)
    expect(deriveFromPake(ra.key, 'pair-secret')).toEqual(deriveFromPake(rb.key, 'pair-secret'))
  })

  it('fails with a wrong code', () => {
    const a = new Spake2('A', '123456', 'fp-1')
    const b = new Spake2('B', '123457', 'fp-1')
    const ra = a.finish(b.message)
    const rb = b.finish(a.message)
    expect(ra.key).not.toEqual(rb.key)
    expect(constantTimeEqual(ra.myConfirm, rb.theirConfirm)).toBe(false)
  })

  it('fails when the transport context differs (MITM on the channel)', () => {
    const a = new Spake2('A', '123456', 'fp-as-seen-by-A')
    const b = new Spake2('B', '123456', 'fp-as-seen-by-B')
    expect(a.finish(b.message).key).not.toEqual(b.finish(a.message).key)
  })

  it('rejects garbage points and double finish', () => {
    const a = new Spake2('A', '1', 'c')
    expect(() => a.finish(new Uint8Array(32).fill(0xff))).toThrow()
    expect(() => a.finish(new Uint8Array(32))).toThrow() // identity point
    const b = new Spake2('B', '1', 'c')
    const c = new Spake2('A', '1', 'c')
    b.finish(c.message)
    expect(() => b.finish(c.message)).toThrow()
  })

  it('pair codes are 6 digits', () => {
    for (let i = 0; i < 20; i++) expect(randomPairCode()).toMatch(/^\d{6}$/)
  })
})
