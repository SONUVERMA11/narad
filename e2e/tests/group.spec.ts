import { expect, test, type BrowserContext } from '@playwright/test'

test('group send: one text reaches every selected device', async ({ browser }) => {
  const ctxs: BrowserContext[] = []
  const pages = []
  for (let i = 0; i < 3; i++) {
    const c = await browser.newContext()
    ctxs.push(c)
    const p = await c.newPage()
    await p.goto('/')
    pages.push(p)
  }
  const [a, b, c] = pages as [typeof pages[0], typeof pages[0], typeof pages[0]]
  for (const p of pages) await expect(p.getByTestId('peer-card')).toHaveCount(2, { timeout: 20_000 })

  await a.getByTestId('select-many').click()
  // select-many pre-selects the first card; add the second
  await a.getByTestId('peer-card').nth(1).click()
  await expect(a.getByTestId('multi-count')).toHaveText('2 selected')
  await a.getByTestId('multi-text').fill('team: standup at 10')
  await a.getByTestId('multi-send').click()
  await expect(a.getByText('Sent to 2')).toBeVisible({ timeout: 20_000 })

  for (const p of [b, c]) {
    await p.getByTestId('peer-card').filter({ hasText: /./ }).first().click()
    // the sender might be either card: open the one with the unread badge if present
    const withMsg = p.getByTestId('chat-message')
    if ((await withMsg.count()) === 0) await p.getByTestId('peer-card').nth(1).click()
    await expect(p.getByTestId('chat-message').first()).toHaveText('team: standup at 10', { timeout: 20_000 })
  }
  await Promise.all(ctxs.map((x) => x.close()))
})
