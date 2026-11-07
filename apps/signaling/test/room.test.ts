import { describe, expect, it } from 'vitest'
import { normalizeIp, Room, roomIdFor, type SocketLike } from '../src/room'
import { generateLicenseKeys, mintLicense } from '@narad/license'

function sock() {
  const out: unknown[] = []
  const s: SocketLike & { out: unknown[]; closed: boolean } = {
    out,
    closed: false,
    send: (d) => out.push(JSON.parse(d)),
    close: () => void (s.closed = true),
  }
  return s
}
const peer = (id: string) => ({ id, deviceId: id.split(':')[0]!, name: 'Neela Garud', device: { os: 'macOS', browser: 'Chrome', type: 'desktop' as const } })

describe('Room', () => {
  it('announces joins, relays signals, announces leaves', () => {
    const room = new Room('code:test', 'code')
    const a = sock()
    const b = sock()
    expect(room.handle(a, JSON.stringify({ t: 'join', peer: peer('a:1') }))).toBe(true)
    expect(a.out[0]).toMatchObject({ t: 'joined', you: 'a:1', peers: [] })
    room.handle(b, JSON.stringify({ t: 'join', peer: peer('b:1') }))
    expect(b.out[0]).toMatchObject({ t: 'joined', peers: [{ id: 'a:1' }] })
    expect(a.out[1]).toMatchObject({ t: 'peer-joined', peer: { id: 'b:1' } })
    room.handle(a, JSON.stringify({ t: 'signal', to: 'b:1', data: { kind: 'candidate', candidate: null } }))
    expect(b.out[1]).toMatchObject({ t: 'signal', from: 'a:1' })
    room.leave(a)
    expect(b.out[2]).toMatchObject({ t: 'peer-left', id: 'a:1' })
    expect(room.size).toBe(1)
  })

  it('rejects invalid peers and signals before join', () => {
    const room = new Room('code:test', 'code')
    const a = sock()
    expect(room.handle(a, JSON.stringify({ t: 'join', peer: { id: 'x' } }))).toBe(false)
    expect(room.handle(a, JSON.stringify({ t: 'signal', to: 'b', data: {} }))).toBe(false)
    expect(room.handle(a, 'not json')).toBe(false)
  })

  it('replaces a stale socket with the same session id', () => {
    const room = new Room('code:test', 'code')
    const a1 = sock()
    const a2 = sock()
    room.handle(a1, JSON.stringify({ t: 'join', peer: peer('a:1') }))
    room.handle(a2, JSON.stringify({ t: 'join', peer: peer('a:1') }))
    expect(a1.closed).toBe(true)
    expect(room.size).toBe(1)
  })
})

describe('roomIdFor', () => {
  it('groups by normalized public ip into a sabha', async () => {
    const a = await roomIdFor(new URL('http://x/ws'), '::ffff:203.0.113.5')
    const b = await roomIdFor(new URL('http://x/ws'), '203.0.113.5')
    expect(a).toEqual(b)
    expect(a.kind).toBe('sabha')
  })
  it('uses the code when given and validates it', async () => {
    expect(await roomIdFor(new URL('http://x/ws?room=Pink-Mango-42'), '1.1.1.1')).toEqual({ id: 'code:pink-mango-42', kind: 'code' })
    await expect(roomIdFor(new URL('http://x/ws?room=bad code!'), '1.1.1.1')).rejects.toThrow()
  })
  it('groups ipv6 by /64', () => {
    expect(normalizeIp('2401:4900:1c2e:abcd:1:2:3:4')).toBe('2401:4900:1c2e:abcd')
  })
})

describe('hardening', () => {
  it('rate-limits a flooding socket and reports it to the audit sink', () => {
    const events: unknown[] = []
    const room = new Room('code:flood', 'code', { audit: (e) => events.push(e) })
    const a = sock()
    room.handle(a, JSON.stringify({ t: 'join', peer: peer('a:1') }))
    let ok = true
    for (let i = 0; i < 60 && ok; i++) ok = room.handle(a, JSON.stringify({ t: 'ping' }))
    expect(ok).toBe(false)
    expect(events.some((e) => (e as { ev: string; what?: string }).what === 'rate')).toBe(true)
    expect(events[0]).toMatchObject({ ev: 'join', kind: 'code', peers: 1 })
    expect(JSON.stringify(events)).not.toContain('Neela') // never names
  })
  it('honours a custom capacity', () => {
    const room = new Room('code:cap', 'code', { capacity: 1 })
    room.handle(sock(), JSON.stringify({ t: 'join', peer: peer('a:1') }))
    const b = sock()
    expect(room.handle(b, JSON.stringify({ t: 'join', peer: peer('b:1') }))).toBe(false)
    expect(b.out[0]).toMatchObject({ t: 'error', message: 'room full' })
  })
})

describe('team license', () => {
  it('lifts the room capacity when a member presents a valid license', async () => {
    const keys = await generateLicenseKeys()
    const room = new Room('code:team', 'code', { capacity: 1, licensePublicKey: keys.publicKey })
    const tok = await mintLicense({ sub: 'order_1', plan: 'team', seats: 10, exp: Math.floor(Date.now() / 1000) + 60 }, keys)
    expect(await room.applyLicense(tok)).toBe(true)
    expect(room.capacity).toBe(40)
    expect(await room.applyLicense('bogus')).toBe(false)
    expect(await new Room('x', 'code', { capacity: 1 }).applyLicense(tok)).toBe(false) // no key configured
  })
})
