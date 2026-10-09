/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

/**
 * Incorpora l'icona per iOS nella pagina come dato `data:`. iOS la scarica con un processo di sistema che,
 * con un certificato HTTPS emesso da una CA locale, può fallire: la tessera sulla Home resta con una "P".
 * Così non c'è nulla da scaricare. Il file PNG resta la fonte: l'icona incorporata ne segue le modifiche.
 */
function inlineAppleTouchIcon(): Plugin {
  const file = 'apple-touch-icon-180x180.png'
  return {
    name: 'inline-apple-touch-icon',
    transformIndexHtml(html) {
      const png = readFileSync(fileURLToPath(new URL(`./public/${file}`, import.meta.url)))
      return html.replace(`href="/${file}"`, `href="data:image/png;base64,${png.toString('base64')}"`)
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    inlineAppleTouchIcon(),
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Pocketly',
        short_name: 'Pocketly',
        description: 'Tieni traccia di spese, entrate, prestiti e previsioni. I dati restano sul tuo dispositivo.',
        lang: 'it',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
  },
})
