import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Narad — Send files online. Free. Instant. No sign‑up.',
        short_name: 'Narad',
        description: 'Send files, text and your clipboard to any device with a 6-digit code or over Wi-Fi. End-to-end encrypted, nothing stored on a server.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: { port: 5173 },
})
