import { expect, test, type Page } from '@playwright/test'

/** Same-network discovery is disabled (?sabha=0), so peers can only find each other via contacts or spaces. */
async function isolated(browser: Parameters<Parameters<typeof test>[2]>[0]['browser']): Promise<[Page, Page, () => Promise<void>]> {
  const ca = await browser.newContext()
  const cb = await browser.newContext()
  const a = await ca.newPage()
  const b = await cb.newPage()
  await a.goto('/?sabha=0')
  await b.goto('/?sabha=0')
  await expect(a.getByTestId('peer-card')).toHaveCount(0)
  return [a, b, async () => { await ca.close(); await cb.close(); await new Promise((r) => setTimeout(r, 500)) }]
}

test('pairing by code makes a contact that survives reload and shows offline when gone', async ({ browser }) => {
  const [a, b, done] = await isolated(browser)
  await a.getByTestId('open-pair').click()
  await a.getByTestId('pair-show').click()
  const code = (await a.getByTestId('pair-code').textContent())!.trim()
  expect(code).toMatch(/^\d{6}$/)

  // B gets the code via the share link (#pair=… never reaches the server)
  await b.goto(`/?sabha=0#pair=${code}`)
  await expect(a.getByTestId('pair-done')).toBeVisible({ timeout: 30_000 })
  await expect(b.getByTestId('pair-done')).toBeVisible({ timeout: 30_000 })

  // Both now see each other through the private pair room, tagged as contact
  await expect(a.getByTestId('badge-contact')).toBeVisible({ timeout: 15_000 })
  await expect(b.getByTestId('badge-contact')).toBeVisible({ timeout: 15_000 })

  // Reload: contacts persist in IndexedDB and auto-join the pair room
  await a.reload()
  await b.reload()
  await expect(a.getByTestId('peer-card')).toHaveCount(1, { timeout: 15_000 })
  await expect(b.getByTestId('badge-contact')).toBeVisible({ timeout: 15_000 })

  // Send a message over the contact connection
  await a.getByTestId('peer-card').click()
  await a.getByTestId('composer').fill('hello contact')
  await a.getByTestId('send').click()
  await b.getByTestId('peer-card').click()
  await expect(b.getByTestId('chat-message').first()).toHaveText('hello contact', { timeout: 20_000 })

  // B leaves → A shows B as an offline contact
  await b.close()
  await expect(a.getByTestId('offline-contact')).toHaveCount(1, { timeout: 15_000 })
  await expect(a.getByTestId('peer-card')).toHaveCount(0)
  await done()
})

test('spaces: invite link joins a persistent room visible on any network', async ({ browser }) => {
  const [a, b, done] = await isolated(browser)
  await a.getByTestId('open-spaces').click()
  await a.getByTestId('space-name').fill('advik-office')
  await a.getByTestId('space-create').click()
  await expect(a.getByTestId('space-item')).toHaveCount(1)
  const link = await a.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('#space=advik-office.')

  await b.getByTestId('open-spaces').click()
  await b.getByTestId('space-link').fill(link)
  await b.getByTestId('space-join').click()
  await expect(b.getByTestId('space-item')).toHaveCount(1)
  await b.keyboard.press('Escape')
  await a.keyboard.press('Escape')

  await expect(a.getByTestId('badge-space')).toHaveText('@advik-office', { timeout: 15_000 })
  await expect(b.getByTestId('badge-space')).toHaveText('@advik-office', { timeout: 15_000 })
  await expect(a.getByTestId('space-chip')).toHaveText('@advik-office · 1')

  // persists across reload
  await b.reload()
  await expect(b.getByTestId('space-chip')).toHaveText('@advik-office · 1', { timeout: 15_000 })
  await done()
})
