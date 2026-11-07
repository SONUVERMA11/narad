import { chromium, expect, test as base, type BrowserContext, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../apps/extension/dist')

/** Chromium with the built extension loaded; its offscreen engine joins the loopback sabha like any other device. */
const test = base.extend<{ ext: BrowserContext; extensionId: string }>({
  ext: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    await use(ctx)
    await ctx.close()
    await new Promise((r) => setTimeout(r, 500))
  },
  extensionId: async ({ ext }, use) => {
    let [sw] = ext.serviceWorkers()
    if (!sw) sw = await ext.waitForEvent('serviceworker')
    await use(sw.url().split('/')[2]!)
  },
})

test('extension popup sends the current page link to a nearby web-app device', async ({ ext, extensionId }) => {
  const web: Page = await ext.newPage()
  await web.goto('/')
  // the extension's offscreen engine shows up as a device
  await expect(web.getByTestId('peer-card')).toHaveCount(1, { timeout: 20_000 })
  await expect(web.getByTestId('peer-card')).toContainText('Chrome')

  const popup = await ext.newPage()
  await popup.goto(`chrome-extension://${extensionId}/popup.html`)
  await expect(popup.getByText('Devices (1)')).toBeVisible({ timeout: 20_000 })
  // make the web page the "active tab" the popup will share
  await web.bringToFront()
  await popup.bringToFront()
  await popup.getByRole('button', { name: /Page/ }).click()
  await expect(popup.getByText('Sent ✓')).toBeVisible({ timeout: 20_000 })

  await web.bringToFront()
  await web.getByTestId('peer-card').click()
  await expect(web.getByTestId('chat-message').first()).toContainText('http', { timeout: 20_000 })
})

test('web app → extension: text lands in the popup inbox', async ({ ext, extensionId }) => {
  const web = await ext.newPage()
  await web.goto('/')
  await expect(web.getByTestId('peer-card')).toHaveCount(1, { timeout: 20_000 })
  await web.getByTestId('peer-card').click()
  await web.getByTestId('composer').fill('hello extension')
  await web.getByTestId('send').click()
  const popup = await ext.newPage()
  await popup.goto(`chrome-extension://${extensionId}/popup.html`)
  await popup.getByRole('button', { name: /Inbox/ }).click()
  await expect(popup.getByText('hello extension')).toBeVisible({ timeout: 20_000 })
})
