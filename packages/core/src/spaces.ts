/**
 * Spaces ("Office mode"): a persistent, named room protected by a secret that lives in
 * the invite link's #fragment, so the server never sees it. Everyone holding the link
 * sees everyone else in the space, on any network.
 */
import { sha256Hex, toBase64, fromBase64 } from './crypto'
import { store } from './identity'

export interface Space {
  name: string
  /** base64url, 16 random bytes */
  secret: string
  joinedAt: number
}

const PREFIX = 'space:'

export const spaces = {
  list: () => store.list<Space>(PREFIX),
  save: (s: Space) => store.set(PREFIX + s.secret, s),
  remove: (s: Space) => store.del(PREFIX + s.secret),
}

export function newSpace(name: string): Space {
  const secret = toBase64url(crypto.getRandomValues(new Uint8Array(16)))
  return { name: normalizeSpaceName(name), secret, joinedAt: Date.now() }
}

export async function spaceRoomId(space: Pick<Space, 'name' | 'secret'>): Promise<string> {
  return 's-' + (await sha256Hex(`narad-space|${space.name}|${space.secret}`)).slice(0, 32)
}

export function spaceLink(origin: string, space: Pick<Space, 'name' | 'secret'>): string {
  return `${origin}/#space=${encodeURIComponent(space.name)}.${space.secret}`
}

/** Parses `#space=<name>.<secret>` from a URL or a bare fragment. Returns undefined if malformed. */
export function parseSpaceLink(input: string): Pick<Space, 'name' | 'secret'> | undefined {
  const hash = input.includes('#') ? input.slice(input.indexOf('#') + 1) : input
  const m = /(?:^|&)space=([^&]+)/.exec(hash)
  if (!m) return undefined
  const dot = m[1]!.lastIndexOf('.')
  if (dot <= 0) return undefined
  const name = normalizeSpaceName(decodeURIComponent(m[1]!.slice(0, dot)))
  const secret = m[1]!.slice(dot + 1)
  if (!name || !/^[A-Za-z0-9_-]{16,32}$/.test(secret)) return undefined
  return { name, secret }
}

export function normalizeSpaceName(name: string): string {
  return name.trim().replace(/^@/, '').slice(0, 32)
}

function toBase64url(b: Uint8Array): string {
  return toBase64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function fromBase64url(s: string): Uint8Array {
  return fromBase64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
}
