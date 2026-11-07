import { expect, test as base, type BrowserContext, type Page } from '@playwright/test'
import { createHash, randomBytes } from 'node:crypto'

/** Two isolated browser contexts share the loopback "sabha" and talk WebRTC to each other. */
const test = base.extend<{ pair: [Page, Page] }>({
  pair: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [await browser.newContext(), await browser.newContext()]
    const a = await contexts[0]!.newPage()
    const b = await contexts[1]!.newPage()
    if (process.env.NARAD_DEBUG) {
      for (const [tag, p] of [['A', a], ['B', b]] as const) {
        p.on('console', (m) => console.log(`[${tag} console]`, m.type(), m.text().slice(0, 200)))
        p.on('pageerror', (e) => console.log(`[${tag} pageerror]`, e.message))
        p.on('websocket', (ws) => {
          console.log(`[${tag} ws open]`, ws.url())
          ws.on('framereceived', (f) => console.log(`[${tag} ws <-]`, String(f.payload).slice(0, 160)))
          ws.on('framesent', (f) => console.log(`[${tag} ws ->]`, String(f.payload).slice(0, 160)))
          ws.on('close', () => console.log(`[${tag} ws close]`))
        })
      }
    }
    await a.goto('/')
    await b.goto('/')
    await expect(a.getByTestId('peer-card')).toHaveCount(1, { timeout: 15_000 })
    await expect(b.getByTestId('peer-card')).toHaveCount(1, { timeout: 15_000 })
    await use([a, b])
    // Close contexts so their signaling sockets leave the shared sabha before the next test.
    await Promise.all(contexts.map((c) => c.close()))
    await new Promise((r) => setTimeout(r, 500))
  },
})

test('text message goes device-to-device with matching SAS emojis', async ({ pair }) => {
  const [a, b] = pair
  await a.getByTestId('peer-card').click()
  await a.getByTestId('composer').fill('नमस्ते from A')
  await a.getByTestId('send').click()
  await b.getByTestId('peer-card').click()
  await expect(b.getByTestId('chat-message').first()).toHaveText('नमस्ते from A', { timeout: 20_000 })
  await expect(a.getByTestId('sas')).toBeVisible()
  await expect(b.getByTestId('sas')).toBeVisible()
  expect(await a.getByTestId('sas').textContent()).toBe(await b.getByTestId('sas').textContent())
})

test('a 3 MB file transfers intact (in-memory fallback + download)', async ({ pair }) => {
  const [a, b] = pair
  const bytes = randomBytes(3 * 1024 * 1024 + 777)
  const sha = createHash('sha256').update(bytes).digest('hex')
  // Headless chromium has no File System Access picker → the app falls back to MemorySink + download.
  await b.addInitScript(() => {
    // @ts-expect-error force fallback path deterministically
    delete window.showSaveFilePicker
  })
  await b.reload()
  await expect(b.getByTestId('peer-card')).toHaveCount(1, { timeout: 15_000 })

  await a.getByTestId('peer-card').click()
  await a.getByTestId('file-input').setInputFiles({ name: 'blob.bin', mimeType: 'application/octet-stream', buffer: bytes })
  await expect(b.getByTestId('incoming')).toBeVisible({ timeout: 20_000 })
  const download = b.waitForEvent('download', { timeout: 60_000 })
  await b.getByTestId('accept').click()
  const dl = await download
  expect(dl.suggestedFilename()).toBe('blob.bin')
  const stream = await dl.createReadStream()
  const hash = createHash('sha256')
  for await (const chunk of stream) hash.update(chunk as Buffer)
  expect(hash.digest('hex')).toBe(sha)
  await expect(a.getByTestId('transfer').first()).toHaveAttribute('data-status', 'done', { timeout: 20_000 })
})

test('declining a transfer marks it rejected on the sender', async ({ pair }) => {
  const [a, b] = pair
  await a.getByTestId('peer-card').click()
  await a.getByTestId('file-input').setInputFiles({ name: 'no.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') })
  await expect(b.getByTestId('incoming')).toBeVisible({ timeout: 20_000 })
  await b.getByTestId('reject').click()
  await expect(a.getByTestId('transfer').first()).toHaveAttribute('data-status', 'rejected', { timeout: 10_000 })
})
