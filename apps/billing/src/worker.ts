import { configured, createCheckout, getLicense, handleWebhook, type BillingEnv, type LicenseStore } from './billing'

export interface Env extends BillingEnv {
  LICENSES: KVNamespace
  ALLOWED_ORIGIN?: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const cors = { 'access-control-allow-origin': env.ALLOWED_ORIGIN ?? '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (!configured(env)) return Response.json({ error: 'billing not configured' }, { status: 503, headers: cors })
    const store: LicenseStore = {
      get: async (k) => (await env.LICENSES.get(`license:${k}`)) ?? undefined,
      set: (k, v) => env.LICENSES.put(`license:${k}`, v, { expirationTtl: 400 * 86400 }),
    }
    let r: { status: number; body?: unknown }
    if (req.method === 'POST' && url.pathname === '/checkout') r = await createCheckout((await req.json()) as { seats: number; org?: string }, env)
    else if (req.method === 'POST' && url.pathname === '/webhook') r = await handleWebhook(await req.text(), req.headers.get('x-razorpay-signature'), env, store)
    else if (req.method === 'GET' && url.pathname.startsWith('/license/')) r = await getLicense(url.pathname.slice('/license/'.length), store)
    else if (url.pathname === '/health') r = { status: 200, body: { ok: true } }
    else r = { status: 404 }
    return r.body ? Response.json(r.body, { status: r.status, headers: cors }) : new Response(null, { status: r.status, headers: cors })
  },
}
