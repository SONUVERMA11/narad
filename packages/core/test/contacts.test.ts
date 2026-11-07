import { describe, expect, it } from 'vitest'
import { naradId, pairRoomId } from '../src/contacts'
import { newSpace, parseSpaceLink, spaceLink, spaceRoomId } from '../src/spaces'

describe('contacts', () => {
  it('pair room is symmetric and fits the server room grammar', async () => {
    const r1 = await pairRoomId('aaaa', 'bbbb', 'secret')
    const r2 = await pairRoomId('bbbb', 'aaaa', 'secret')
    expect(r1).toBe(r2)
    expect(r1).toMatch(/^[a-z0-9-]{3,40}$/)
    expect(await pairRoomId('aaaa', 'bbbb', 'other')).not.toBe(r1)
  })
  it('narad id is a slug plus short device tag', () => {
    expect(naradId('Rohan Bex', '7k2pabcd')).toBe('rohan-bex#7k2p')
    expect(naradId('नीला गरुड़', '1234')).toMatch(/#1234$/)
  })
})

describe('spaces', () => {
  it('round-trips through an invite link and derives a valid room', async () => {
    const s = newSpace('@Advik Office')
    expect(s.name).toBe('Advik Office')
    const link = spaceLink('https://narad.sh', s)
    expect(link.startsWith('https://narad.sh/#space=')).toBe(true)
    expect(parseSpaceLink(link)).toEqual({ name: s.name, secret: s.secret })
    expect(await spaceRoomId(s)).toMatch(/^s-[0-9a-f]{32}$/)
    expect(parseSpaceLink('https://x/#space=noSecret')).toBeUndefined()
    expect(parseSpaceLink('https://x/?room=abc')).toBeUndefined()
  })
})
