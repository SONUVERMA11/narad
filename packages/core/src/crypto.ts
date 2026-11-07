/**
 * Chakra — application-layer end-to-end encryption.
 * ECDH (P-256) per session → HKDF-SHA256 → AES-256-GCM. SAS emojis for verification.
 * Independent of WebRTC's DTLS so a hostile signaling server cannot MITM silently.
 */

const subtle = globalThis.crypto.subtle
const te = new TextEncoder()
const td = new TextDecoder()

export interface SessionKeys {
  privateKey: CryptoKey
  publicRaw: Uint8Array
}

export async function generateSessionKeys(): Promise<SessionKeys> {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const publicRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey))
  return { privateKey: kp.privateKey, publicRaw }
}

export async function deriveSharedKey(mine: SessionKeys, theirPublicRaw: Uint8Array, salt: string): Promise<CryptoKey> {
  const theirs = await subtle.importKey('raw', theirPublicRaw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const bits = await subtle.deriveBits({ name: 'ECDH', public: theirs }, mine.privateKey, 256)
  const hkdfKey = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: te.encode(`narad-v1|${salt}`), info: te.encode('narad-session') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const SAS_EMOJI = [
  '🪔', '🐘', '🥭', '🌊', '🦚', '🌸', '🔔', '🪷', '🐯', '🌙', '☀️', '⭐', '🌴', '🦜', '🐢', '🪁',
  '🥥', '🍵', '🪘', '🎋', '🏔️', '🌾', '🐄', '🐒', '🦌', '🦢', '🐍', '🐦', '🍋', '🍉', '🌶️', '🪻',
  '🔱', '🪶', '🎪', '🚩', '🪙', '📿', '🎨', '🧿', '🪞', '🛕', '⛵', '🚂', '🛺', '🎠', '🌺', '🍀',
  '🧵', '🪡', '🥁', '🎻', '🪈', '🏹', '🗝️', '🧭', '💎', '🪨', '🔥', '💧', '🌬️', '🌍', '🌈', '🌟',
]

/** Short authentication string: 4 emojis derived from both public keys (order independent). */
export async function sasEmojis(a: Uint8Array, b: Uint8Array): Promise<string[]> {
  const [x, y] = compareBytes(a, b) <= 0 ? [a, b] : [b, a]
  const joined = new Uint8Array(x.length + y.length)
  joined.set(x, 0)
  joined.set(y, x.length)
  const digest = new Uint8Array(await subtle.digest('SHA-256', joined as BufferSource))
  return [0, 1, 2, 3].map((i) => SAS_EMOJI[digest[i]! % SAS_EMOJI.length]!)
}

export async function encryptBytes(key: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext as BufferSource))
  const out = new Uint8Array(12 + ct.length)
  out.set(iv, 0)
  out.set(ct, 12)
  return out
}

export async function decryptBytes(key: CryptoKey, payload: Uint8Array): Promise<Uint8Array> {
  const iv = payload.subarray(0, 12)
  const ct = payload.subarray(12)
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource))
}

export const encryptJson = (key: CryptoKey, obj: unknown) => encryptBytes(key, te.encode(JSON.stringify(obj)) as Uint8Array)
export const decryptJson = async <T>(key: CryptoKey, payload: Uint8Array): Promise<T> =>
  JSON.parse(td.decode(await decryptBytes(key, payload))) as T

export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i]! - b[i]!
  return a.length - b.length
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
export function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? te.encode(data) : data
  const d = new Uint8Array(await subtle.digest('SHA-256', bytes as BufferSource))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}
