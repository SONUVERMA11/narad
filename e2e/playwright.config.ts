import { defineConfig } from '@playwright/test'

// E2E_SIGNALING_PORT isolates the suite from a running dev signaling server (and from any
// extension / tab on this machine that is connected to it); default reuses the dev port.
const SIG = process.env.E2E_SIGNALING_PORT ?? '8794'
const buildEnv: Record<string, string> = process.env.E2E_SIGNALING_PORT ? { VITE_SIGNALING_URL: `ws://127.0.0.1:${SIG}/ws` } : {}

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'pnpm --filter @narad/signaling start', url: `http://127.0.0.1:${SIG}/health`, reuseExistingServer: true, env: { NARAD_PORT: SIG } },
    {
      command: 'pnpm --filter @narad/extension build && pnpm --filter @narad/web build && pnpm --filter @narad/web preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 180_000,
      env: buildEnv,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
