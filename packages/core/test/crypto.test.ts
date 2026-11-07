import { describe, expect, it } from 'vitest'
import { decryptBytes, decryptJson, deriveSharedKey, encryptBytes, encryptJson, fromBase64, generateSessionKeys, sasEmojis, toBase64 } from '../src/crypto'

describe('Chakra crypto', () => {
  it('derives the same key on both sides and round-trips data', async () => {
    const a = await generateSessionKeys()
    const b = await generateSessionKeys()
    const ka = await deriveSharedKey(a, b.publicRaw, 'x|y')
    const kb = await deriveSharedKey(b, a.publicRaw, 'x|y')
    const ct = await encryptJson(ka, { hello: 'नमस्ते', n: 42 })
    expect(await decryptJson(kb, ct)).toEqual({ hello: 'नमस्ते', n: 42 })
    const big = crypto.getRandomValues(new Uint8Array(65536))
    expect(await decryptBytes(kb, await encryptBytes(ka, big))).toEqual(big)
  })

  it('fails to decrypt with a different salt (different session)', async () => {
    const a = await generateSessionKeys()
    const b = await generateSessionKeys()
    const ka = await deriveSharedKey(a, b.publicRaw, 'salt-1')
    const kb = await deriveSharedKey(b, a.publicRaw, 'salt-2')
    await expect(decryptJson(kb, await encryptJson(ka, { x: 1 }))).rejects.toThrow()
  })

  it('SAS emojis are order independent and 4 long', async () => {
    const a = await generateSessionKeys()
    const b = await generateSessionKeys()
    const s1 = await sasEmojis(a.publicRaw, b.publicRaw)
    const s2 = await sasEmojis(b.publicRaw, a.publicRaw)
    expect(s1).toEqual(s2)
    expect(s1).toHaveLength(4)
  })

  it('base64 helpers round-trip', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(100))
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })
})
