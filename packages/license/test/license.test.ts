import { describe, expect, it } from 'vitest'
import { capacityFor, generateLicenseKeys, mintLicense, verifyLicense } from '../src'

describe('team license', () => {
  it('mints and verifies; rejects tampering, wrong key and expiry', async () => {
    const keys = await generateLicenseKeys()
    const exp = Math.floor(Date.now() / 1000) + 3600
    const tok = await mintLicense({ sub: 'order_1', plan: 'team', seats: 25, exp, org: 'Advik' }, keys)
    const claims = await verifyLicense(tok, keys.publicKey)
    expect(claims).toMatchObject({ sub: 'order_1', plan: 'team', seats: 25, org: 'Advik' })
    expect(capacityFor(claims)).toBe(100)
    expect(capacityFor(undefined)).toBe(50)
    // tamper with the body
    const [h, b, s] = tok.split('.')
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...claims, seats: 999 })).toString('base64url')}.${s}`
    expect(await verifyLicense(forged, keys.publicKey)).toBeUndefined()
    const other = await generateLicenseKeys()
    expect(await verifyLicense(tok, other.publicKey)).toBeUndefined()
    expect(await verifyLicense(tok, keys.publicKey, (exp + 1) * 1000)).toBeUndefined()
    expect(await verifyLicense('garbage', keys.publicKey)).toBeUndefined()
  })
})
