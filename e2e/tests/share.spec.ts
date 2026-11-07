import { expect, test, type Page } from '@playwright/test'

/** Share-by-code: A picks items and gets a 6-digit code; B types it (or opens #code=…) and receives, then adds A as a contact. */
async function isolated(browser: Parameters<Parameters<typeof test>[2]>[0]['browser']): Promise<[Page, Page, () => Promise<void>]> {
  const ca = await browser.newContext()
  const cb = await browser.newContext()
  const a = await ca.newPage()
  const b = await cb.newPage()
  // Chromium would open a native save dialog; force the in-memory/download fallback like transfer.spec does.
  await b.addInitScript(() => {
    // @ts-expect-error force fallback path deterministically
    delete window.showSaveFilePicker
  })
  await a.goto('/?sabha=0')
  await b.goto('/?sabha=0')
  await expect(a.getByTestId('peer-card')).toHaveCount(0)
  return [a, b, async () => { await ca.close(); await cb.close(); await new Promise((r) => setTimeout(r, 500)) }]
}

test('share with code delivers text + file to whoever enters it, and can become a contact', async ({ browser }) => {
  const [a, b, done] = await isolated(browser)
  await a.getByTestId('open-share').click()
  await a.getByTestId('share-text').fill('meeting link: https://example.com/room')
  await a.getByTestId('share-files').setInputFiles({ name: 'deck.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(300_000, 7) })
  await expect(a.getByTestId('share-list')).toContainText('deck.pdf')
  await a.getByTestId('share-start').click()
  const code = (await a.getByTestId('share-code').textContent())!.trim()
  expect(code).toMatch(/^\d{6}$/)
  await expect(a.getByTestId('share-link')).toContainText(`#code=${code}`)

  // B types the code
  await b.getByTestId('open-receive').click()
  await b.getByTestId('receive-input').fill(code)
  await b.getByTestId('receive-join').click()

  // text arrives directly; the file needs one tap
  await expect(b.getByTestId('chat-message').first()).toHaveText('meeting link: https://example.com/room', { timeout: 30_000 })
  await expect(b.getByTestId('incoming')).toBeVisible({ timeout: 20_000 })
  const download = b.waitForEvent('download', { timeout: 60_000 })
  await b.getByTestId('accept').click()
  expect((await download).suggestedFilename()).toBe('deck.pdf')
  await expect(a.getByTestId('share-sent')).toContainText('Delivered to', { timeout: 15_000 })

  // B keeps A as a contact; both sides adopt
  await b.getByTestId('add-contact').click()
  await expect(b.getByTestId('badge-contact')).toBeVisible({ timeout: 20_000 })
  await expect(a.getByTestId('badge-contact')).toBeVisible({ timeout: 20_000 })

  // a second receiver via the deep link also gets the items while the code is open
  const cc = await browser.newContext()
  const c = await cc.newPage()
  await c.goto(`/?sabha=0#code=${code}`)
  await expect(c.getByTestId('chat-message').first()).toHaveText('meeting link: https://example.com/room', { timeout: 30_000 })
  await expect(a.getByTestId('share-sent').locator('li')).toHaveCount(2, { timeout: 15_000 })
  await a.getByTestId('share-stop').click()
  await cc.close()
  await done()
})
