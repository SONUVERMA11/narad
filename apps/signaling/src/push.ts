/**
 * Web Push "nudge" — the one place Narad stores anything server-side, and it is opt-in:
 * a push subscription (an opaque URL from the browser's push service) filed under a token
 * that only one contact pair can derive. The push carries NO payload; the service worker
 * shows "a contact wants to reach you". Runs on Node and Workers (WebCrypto + fetch only).
 */
export interface PushEnv {
  /** base64url, 65-byte uncompressed P-256 public key */
  VAPID_PUBLIC_KEY?: string
  /** base64url, 32-byte private scalar */
  VAPID_PRIVATE_KEY?: string
  /** mailto: or https: contact for the push service */
  VAPID_SUBJECT?: string
}

export interface PushSubscriptionJSONLike {
  endpoint: string
  keys?: Record<string, string>
  expirationTime?: number | null
}

export interface PushStore {
  get(token: string): Promise<PushSubscriptionJSONLike | undefined>
  set(token: string, sub: PushSubscriptionJSONLike): Promise<void>
  del(token: string): Promise<void>
}

export class MemoryPushStore implements PushStore {
  private m = new Map<string, PushSubscriptionJSONLike>()
  async get(t: string) {
    return this.m.get(t)
  }
  async set(t: string, s: PushSubscriptionJSONLike) {
    this.m.set(t, s)
  }
  async del(t: string) {
    this.m.delete(t)
  }
  get size() {
    return this.m.size
  }
}

export interface PushResponse {
  status: number
  body?: unknown
}

const NUDGE_INTERVAL = 30_000
const lastNudge = new Map<string, number>()

export const pushEnabled = (env: PushEnv) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)

/** Router for /push/* . `fetchImpl` is injectable for tests. */
export async function handlePush(
  method: string,
  path: string,
  readJson: () => Promise<unknown>,
  env: PushEnv,
  store: PushStore,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResponse> {
  if (!pushEnabled(env)) return { status: 404, body: { error: 'push disabled' } }
  if (method === 'GET' && path === '/push/key') return { status: 200, body: { publicKey: env.VAPID_PUBLIC_KEY } }
  if (method !== 'POST') return { status: 405 }
  const body = (await readJson().catch(() => undefined)) as { token?: string; subscription?: PushSubscriptionJSONLike } | undefined
  const token = body?.token
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return { status: 400, body: { error: 'bad token' } }
  switch (path) {
    case '/push/subscribe': {
      const sub = body?.subscription
      if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || sub.endpoint.length > 2048) return { status: 400, body: { error: 'bad subscription' } }
      await store.set(token, { endpoint: sub.endpoint, keys: sub.keys, expirationTime: sub.expirationTime ?? null })
      lastNudge.delete(token)
      return { status: 204 }
    }
    case '/push/unsubscribe':
      await store.del(token)
      return { status: 204 }
    case '/push/nudge': {
      const sub = await store.get(token)
      if (!sub) return { status: 404, body: { error: 'unknown token' } }
      const last = lastNudge.get(token) ?? 0
      if (Date.now() - last < NUDGE_INTERVAL) return { status: 429, body: { error: 'too soon' } }
      lastNudge.set(token, Date.now())
      const res = await sendEmptyPush(sub.endpoint, env, fetchImpl)
      if (res === 404 || res === 410) {
        await store.del(token)
        return { status: 410, body: { error: 'subscription gone' } }
      }
      return { status: res >= 200 && res < 300 ? 202 : 502, body: { upstream: res } }
    }
  }
  return { status: 404 }
}

/** POST an empty push (no payload ⇒ no content encryption needed) with a VAPID JWT. Returns the upstream status. */
export async function sendEmptyPush(endpoint: string, env: PushEnv, fetchImpl: typeof fetch = fetch): Promise<number> {
  const jwt = await vapidJwt(endpoint, env)
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`, TTL: '60', 'Content-Length': '0', Urgency: 'high' },
  })
  return res.status
}

export async function vapidJwt(endpoint: string, env: PushEnv): Promise<string> {
  const pub = fromB64url(env.VAPID_PUBLIC_KEY!)
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point')
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x: toB64url(pub.subarray(1, 33)), y: toB64url(pub.subarray(33, 65)), d: env.VAPID_PRIVATE_KEY, ext: true }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = toB64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = toB64url(
    new TextEncoder().encode(
      JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT ?? 'mailto:admin@narad.sh' }),
    ),
  )
  const signingInput = `${header}.${claims}`
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput)))
  return `${signingInput}.${toB64url(sig)}`
}

export function toB64url(b: Uint8Array): string {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}
