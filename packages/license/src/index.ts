/**
 * Team licenses: compact ES256 JWTs minted by the billing worker and verified offline by the
 * signaling server (bigger rooms) and the web app (Team UI). WebCrypto only; runs anywhere.
 */
export interface LicenseClaims {
  /** order / customer reference */
  sub: string
  plan: 'team' | 'selfhost'
  seats: number
  /** issued at / expiry, unix seconds */
  iat: number
  exp: number
  /** optional organisation label shown in the UI (never used for auth) */
  org?: string
}

const te = new TextEncoder()
const td = new TextDecoder()

export function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function unb64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Generate a signing key pair. Returns base64url raw public key and the private scalar `d`. */
export async function generateLicenseKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  return { publicKey: b64url(raw), privateKey: jwk.d! }
}

async function importPrivate(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const pub = unb64url(publicKey)
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)), d: privateKey, ext: true }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}
async function importPublic(publicKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', unb64url(publicKey) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
}

export async function mintLicense(claims: Omit<LicenseClaims, 'iat'> & { iat?: number }, keys: { publicKey: string; privateKey: string }): Promise<string> {
  const key = await importPrivate(keys.publicKey, keys.privateKey)
  const header = b64url(te.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'narad-license-v1' })))
  const body = b64url(te.encode(JSON.stringify({ iat: Math.floor(Date.now() / 1000), ...claims })))
  const input = `${header}.${body}`
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(input)))
  return `${input}.${b64url(sig)}`
}

/** Returns the claims if the token is well-formed, signed by `publicKey` and not expired; otherwise undefined. */
export async function verifyLicense(token: string, publicKey: string, now = Date.now()): Promise<LicenseClaims | undefined> {
  const parts = token.split('.')
  if (parts.length !== 3) return undefined
  const [h, b, s] = parts as [string, string, string]
  try {
    const header = JSON.parse(td.decode(unb64url(h))) as { alg?: string }
    if (header.alg !== 'ES256') return undefined
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await importPublic(publicKey), unb64url(s) as BufferSource, te.encode(`${h}.${b}`))
    if (!ok) return undefined
    const claims = JSON.parse(td.decode(unb64url(b))) as LicenseClaims
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) return undefined
    if (typeof claims.seats !== 'number' || claims.seats < 1) return undefined
    if (claims.plan !== 'team' && claims.plan !== 'selfhost') return undefined
    return claims
  } catch {
    return undefined
  }
}

/** Room capacity for a plan: Team rooms fit the whole org. */
export function capacityFor(claims: LicenseClaims | undefined, base = 50): number {
  if (!claims) return base
  return Math.max(base, Math.min(2000, claims.seats * 4))
}
