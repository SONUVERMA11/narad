import { describe, expect, it } from 'vitest'
import { fromB64url, handlePush, MemoryPushStore, vapidJwt, type PushEnv } from '../src/push'

async function keys(): Promise<PushEnv> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  return { VAPID_PUBLIC_KEY: Buffer.from(raw).toString('base64url'), VAPID_PRIVATE_KEY: jwk.d, VAPID_SUBJECT: 'mailto:t@narad.sh' }
}
const token = 'a'.repeat(64)
const sub = { endpoint: 'https://push.example.com/send/abc', keys: { p256dh: 'x', auth: 'y' } }

describe('push nudge', () => {
  it('is disabled without VAPID keys', async () => {
    expect((await handlePush('GET', '/push/key', async () => ({}), {}, new MemoryPushStore())).status).toBe(404)
  })

  it('subscribes, nudges with a valid VAPID JWT, and rate-limits', async () => {
    const env = await keys()
    const store = new MemoryPushStore()
    const calls: { url: string; auth: string }[] = []
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), auth: String((init!.headers as Record<string, string>).Authorization) })
      return new Response(null, { status: 201 })
    }) as typeof fetch
    expect((await handlePush('GET', '/push/key', async () => ({}), env, store)).body).toEqual({ publicKey: env.VAPID_PUBLIC_KEY })
    expect((await handlePush('POST', '/push/subscribe', async () => ({ token, subscription: sub }), env, store)).status).toBe(204)
    expect((await handlePush('POST', '/push/subscribe', async () => ({ token: 'short', subscription: sub }), env, store)).status).toBe(400)
    const r = await handlePush('POST', '/push/nudge', async () => ({ token }), env, store, fakeFetch)
    expect(r.status).toBe(202)
    expect(calls[0]!.url).toBe(sub.endpoint)
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(calls[0]!.auth)!
    expect(m[2]).toBe(env.VAPID_PUBLIC_KEY)
    // JWT verifies with the public key and has the right audience
    const [h, c, s] = m[1]!.split('.')
    const claims = JSON.parse(Buffer.from(c!, 'base64url').toString())
    expect(claims.aud).toBe('https://push.example.com')
    const pub = await crypto.subtle.importKey('raw', fromB64url(env.VAPID_PUBLIC_KEY!) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64url(s!) as BufferSource, new TextEncoder().encode(`${h}.${c}`))
    expect(ok).toBe(true)
    // second nudge within 30s is throttled; unknown token is 404
    expect((await handlePush('POST', '/push/nudge', async () => ({ token }), env, store, fakeFetch)).status).toBe(429)
    expect((await handlePush('POST', '/push/nudge', async () => ({ token: 'b'.repeat(64) }), env, store, fakeFetch)).status).toBe(404)
    expect((await handlePush('POST', '/push/unsubscribe', async () => ({ token }), env, store)).status).toBe(204)
    expect(store.size).toBe(0)
  })

  it('drops a subscription the push service reports gone', async () => {
    const env = await keys()
    const store = new MemoryPushStore()
    await handlePush('POST', '/push/subscribe', async () => ({ token, subscription: sub }), env, store)
    const gone = (async () => new Response(null, { status: 410 })) as typeof fetch
    expect((await handlePush('POST', '/push/nudge', async () => ({ token }), env, store, gone)).status).toBe(410)
    expect(store.size).toBe(0)
    expect((await vapidJwt(sub.endpoint, env)).split('.')).toHaveLength(3)
  })
})
