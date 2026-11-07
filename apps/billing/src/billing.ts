/**
 * Team plan billing (Razorpay) → signed license. Runtime-agnostic core; `worker.ts` adapts it.
 * Flow: POST /checkout → Razorpay order → client pays with Checkout.js →
 *       Razorpay webhook payment.captured → we mint a license and store it by order id →
 *       client polls GET /license/:orderId and keeps the token on-device.
 */
import { mintLicense } from '@narad/license'

export interface BillingEnv {
  RAZORPAY_KEY_ID?: string
  RAZORPAY_KEY_SECRET?: string
  RAZORPAY_WEBHOOK_SECRET?: string
  LICENSE_PUBLIC_KEY?: string
  LICENSE_PRIVATE_KEY?: string
  /** per seat per month, in paise (₹149 = 14900) */
  PRICE_PER_SEAT_PAISE?: string
}

export interface LicenseStore {
  get(orderId: string): Promise<string | undefined>
  set(orderId: string, token: string): Promise<void>
}

export class MemoryLicenseStore implements LicenseStore {
  m = new Map<string, string>()
  async get(k: string) {
    return this.m.get(k)
  }
  async set(k: string, v: string) {
    this.m.set(k, v)
  }
}

export const MIN_SEATS = 3
export const MAX_SEATS = 500

export function configured(env: BillingEnv): boolean {
  return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET && env.LICENSE_PUBLIC_KEY && env.LICENSE_PRIVATE_KEY)
}

export async function createCheckout(input: { seats: number; org?: string }, env: BillingEnv, fetchImpl: typeof fetch = fetch) {
  const seats = Math.floor(Number(input.seats))
  if (!Number.isFinite(seats) || seats < MIN_SEATS || seats > MAX_SEATS) return { status: 400, body: { error: `seats must be ${MIN_SEATS}-${MAX_SEATS}` } }
  const org = (input.org ?? '').toString().slice(0, 60)
  const amount = seats * Number(env.PRICE_PER_SEAT_PAISE ?? 14900)
  const res = await fetchImpl('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}` },
    body: JSON.stringify({ amount, currency: 'INR', receipt: `narad-${Date.now()}`, notes: { seats: String(seats), org, plan: 'team' } }),
  })
  if (!res.ok) return { status: 502, body: { error: 'razorpay order failed', upstream: res.status } }
  const order = (await res.json()) as { id: string; amount: number; currency: string }
  return { status: 200, body: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID, seats, org } }
}

/** Razorpay signs webhooks with HMAC-SHA256(secret, rawBody), hex in X-Razorpay-Signature. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')
  if (hex.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

interface RazorpayWebhook {
  event: string
  payload?: { payment?: { entity?: { order_id?: string; notes?: Record<string, string>; email?: string } } }
}

export async function handleWebhook(rawBody: string, signature: string | null, env: BillingEnv, store: LicenseStore) {
  if (!(await verifyWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET!))) return { status: 401, body: { error: 'bad signature' } }
  let hook: RazorpayWebhook
  try {
    hook = JSON.parse(rawBody) as RazorpayWebhook
  } catch {
    return { status: 400, body: { error: 'bad json' } }
  }
  if (hook.event !== 'payment.captured' && hook.event !== 'order.paid') return { status: 200, body: { ignored: hook.event } }
  const entity = hook.payload?.payment?.entity
  const orderId = entity?.order_id
  const seats = Number(entity?.notes?.seats)
  if (!orderId || !Number.isFinite(seats) || seats < 1) return { status: 400, body: { error: 'missing order/seats' } }
  if (await store.get(orderId)) return { status: 200, body: { ok: true, duplicate: true } }
  const now = Math.floor(Date.now() / 1000)
  const token = await mintLicense(
    { sub: orderId, plan: 'team', seats, exp: now + 31 * 86400, org: entity?.notes?.org || undefined },
    { publicKey: env.LICENSE_PUBLIC_KEY!, privateKey: env.LICENSE_PRIVATE_KEY! },
  )
  await store.set(orderId, token)
  return { status: 200, body: { ok: true } }
}

export async function getLicense(orderId: string, store: LicenseStore) {
  if (!/^order_[A-Za-z0-9]{6,32}$/.test(orderId)) return { status: 400, body: { error: 'bad order id' } }
  const token = await store.get(orderId)
  return token ? { status: 200, body: { license: token } } : { status: 404, body: { error: 'not paid yet' } }
}
