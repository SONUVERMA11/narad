import { describe, expect, it } from 'vitest'
import { iceServersFor } from '../src/ice'

describe('ice config', () => {
  it('returns STUN only without a TURN secret', async () => {
    const s = await iceServersFor({})
    expect(s).toHaveLength(1)
    expect(s[0]!.urls[0]).toMatch(/^stun:/)
  })
  it('mints coturn use-auth-secret credentials', async () => {
    const s = await iceServersFor({ TURN_SECRET: 'abc', TURN_URLS: 'turn:t:3478,turns:t:5349', TURN_TTL: '60' })
    const turn = s[1]!
    expect(turn.urls).toEqual(['turn:t:3478', 'turns:t:5349'])
    expect(turn.username).toMatch(/^\d+:narad$/)
    const expiry = Number(turn.username!.split(':')[0])
    expect(expiry).toBeGreaterThan(Date.now() / 1000 + 30)
    expect(turn.credential).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })
})
