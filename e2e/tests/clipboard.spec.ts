import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/** Two paired devices (?sabha=0) with clipboard sync on both sides. */
test('clipboard sync pushes a copied text to the paired device', async ({ browser }) => {
  const ctxs: BrowserContext[] = [await browser.newContext(), await browser.newContext()]
  const a: Page = await ctxs[0]!.newPage()
  const b: Page = await ctxs[1]!.newPage()
  await a.goto('/?sabha=0')
  await b.goto('/?sabha=0')
  await a.getByTestId('open-pair').click()
  await a.getByTestId('pair-show').click()
  const code = (await a.getByTestId('pair-code').textContent())!.trim()
  await b.goto(`/?sabha=0#pair=${code}`)
  await expect(a.getByTestId('pair-done')).toBeVisible({ timeout: 30_000 })
  await expect(b.getByTestId('pair-done')).toBeVisible({ timeout: 30_000 })
  await a.keyboard.press('Escape')
  await b.keyboard.press('Escape')
  await expect(a.getByTestId('badge-contact')).toBeVisible({ timeout: 15_000 })

  await a.getByTestId('peer-card').click()
  await a.getByTestId('sync-clip').check()
  await b.getByTestId('peer-card').click()
  await b.getByTestId('sync-clip').check()

  // A copies something (watcher only runs while A is focused)
  await a.bringToFront()
  await a.evaluate(() => navigator.clipboard.writeText('seed text')) // baseline
  await a.waitForTimeout(2000)
  await a.evaluate(() => navigator.clipboard.writeText('नारद clipboard 🪔'))
  // B's clipboard should now contain it (B applies in the background; readText needs B focused)
  await expect
    .poll(async () => {
      await b.bringToFront()
      return b.evaluate(() => navigator.clipboard.readText())
    }, { timeout: 20_000 })
    .toBe('नारद clipboard 🪔')
  await Promise.all(ctxs.map((c) => c.close()))
})
