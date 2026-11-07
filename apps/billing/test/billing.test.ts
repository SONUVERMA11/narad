import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { generateLicenseKeys, verifyLicense } from '@narad/license'
import { createCheckout, getLicense, handleWebhook, MemoryLicenseStore, type BillingEnv } from '../src/billing'

async function env(): Promise<BillingEnv> {
  const k = await generateLicenseKeys()
  return { RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'sec', RAZORPAY_WEBHOOK_SECRET: 'whsec', LICENSE_PUBLIC_KEY: k.publicKey, LICENSE_PRIVATE_KEY: k.privateKey, PRICE_PER_SEAT_PAISE: '14900' }
}
const sign = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('hex')

describe('billing', () => {
  it('creates a Razorpay order for N seats', async () => {
    const e = await env()
    let sent: { url: string; auth: string; body: { amount: number; notes: { seats: string } } } | undefined
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      sent = { url: String(url), auth: String((init!.headers as Record<string, string>).authorization), body: JSON.parse(String(init!.body)) }
      return new Response(JSON.stringify({ id: 'order_ABC123', amount: sent.body.amount, currency: 'INR' }), { status: 200 })
    }) as typeof fetch
    const r = await createCheckout({ seats: 10, org: 'Advik' }, e, fakeFetch)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ orderId: 'order_ABC123', amount: 149000, keyId: 'rzp_test_x', seats: 10 })
    expect(sent!.auth).toBe(`Basic ${Buffer.from('rzp_test_x:sec').toString('base64')}`)
    expect(sent!.body.notes.seats).toBe('10')
    expect((await createCheckout({ seats: 1 }, e, fakeFetch)).status).toBe(400)
  })

  it('mints a verifiable license on a signed payment.captured webhook, idempotently', async () => {
    const e = await env()
    const store = new MemoryLicenseStore()
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'order_ABC123', notes: { seats: '10', org: 'Advik' } } } } })
    expect((await handleWebhook(body, 'deadbeef', e, store)).status).toBe(401)
    expect((await handleWebhook(body, sign(body, 'whsec'), e, store)).status).toBe(200)
    expect((await handleWebhook(body, sign(body, 'whsec'), e, store)).body).toMatchObject({ duplicate: true })
    const lic = await getLicense('order_ABC123', store)
    expect(lic.status).toBe(200)
    const claims = await verifyLicense((lic.body as { license: string }).license, e.LICENSE_PUBLIC_KEY!)
    expect(claims).toMatchObject({ sub: 'order_ABC123', plan: 'team', seats: 10, org: 'Advik' })
    expect((await getLicense('order_NOPE12', store)).status).toBe(404)
    expect((await getLicense('../etc', store)).status).toBe(400)
    const other = JSON.stringify({ event: 'payment.failed' })
    expect((await handleWebhook(other, sign(other, 'whsec'), e, store)).body).toMatchObject({ ignored: 'payment.failed' })
  })
})
