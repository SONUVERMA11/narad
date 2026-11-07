import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function pair(browser: Parameters<Parameters<typeof test>[2]>[0]['browser']): Promise<[Page, Page, BrowserContext[]]> {
  const ctxs = [await browser.newContext(), await browser.newContext()]
  const a = await ctxs[0]!.newPage()
  const b = await ctxs[1]!.newPage()
  await b.addInitScript(() => {
    // @ts-expect-error force the in-memory sink so the download can be hashed
    delete window.showSaveFilePicker
  })
  await a.goto('/')
  await b.goto('/')
  await expect(a.getByTestId('peer-card')).toHaveCount(1, { timeout: 15_000 })
  await expect(b.getByTestId('peer-card')).toHaveCount(1, { timeout: 15_000 })
  return [a, b, ctxs]
}

test('a transfer survives a dropped connection and resumes from the last byte', async ({ browser }) => {
  const [a, b, ctxs] = await pair(browser)
  const bytes = randomBytes(24 * 1024 * 1024)
  const sha = createHash('sha256').update(bytes).digest('hex')
  await a.getByTestId('peer-card').click()
  await a.getByTestId('file-input').setInputFiles({ name: 'movie.bin', mimeType: 'application/octet-stream', buffer: bytes })
  await expect(b.getByTestId('incoming')).toBeVisible({ timeout: 20_000 })
  const download = b.waitForEvent('download', { timeout: 120_000 })
  await b.getByTestId('accept').click()

  // Wait until some bytes have flowed, then kill the WebRTC connection on the sender.
  await expect(a.getByTestId('transfer').first()).toContainText('%', { timeout: 20_000 })
  await a.evaluate(() => {
    const n = (window as unknown as { __narad: { peers(): { info: { id: string } }[]; disconnect(id: string): void } }).__narad
    n.disconnect(n.peers()[0]!.info.id)
  })
  await expect(a.getByTestId('transfer').first()).toHaveAttribute('data-status', 'paused', { timeout: 10_000 })

  // Narad reconnects on its own and the transfer finishes.
  await expect(a.getByTestId('transfer').first()).toHaveAttribute('data-status', 'done', { timeout: 60_000 })
  await expect(a.getByTestId('transfer').first()).toContainText('resumed ×1')
  const dl = await download
  const hash = createHash('sha256')
  for await (const chunk of await dl.createReadStream()) hash.update(chunk as Buffer)
  expect(hash.digest('hex')).toBe(sha)
  await Promise.all(ctxs.map((c) => c.close()))
})

test('a folder keeps its relative paths', async ({ browser }) => {
  const [a, b, ctxs] = await pair(browser)
  await a.getByTestId('peer-card').click()
  const root = mkdtempSync(join(tmpdir(), 'narad-'))
  const docs = join(root, 'docs')
  mkdirSync(join(docs, 'img'), { recursive: true })
  writeFileSync(join(docs, 'readme.txt'), 'hi')
  writeFileSync(join(docs, 'img', 'logo.svg'), '<svg/>')
  await a.getByTestId('dir-input').setInputFiles(docs)
  await expect(b.getByTestId('incoming')).toBeVisible({ timeout: 20_000 })
  await b.getByTestId('accept').click()
  await b.getByTestId('peer-card').click()
  await expect(b.getByTestId('transfer').first()).toHaveAttribute('data-status', 'done', { timeout: 20_000 })
  await expect(b.getByTestId('transfer').first()).toContainText('docs/img/logo.svg')
  await Promise.all(ctxs.map((c) => c.close()))
})
