/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
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

/** Uscita di un comando git, o '' senza git (es. copia senza cartella .git) o se il comando fallisce. */
function git(args: string, timeout = 10_000): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'], timeout }).toString().trim()
  } catch {
    return ''
  }
}

/**
 * Numero di versione: le prime due cifre da package.json (si alzano a mano per i passaggi grandi), l'ultima è il numero
 * di commit e cresce da sola a ogni rilascio (es. 0.1.315). Vercel scarica una copia parziale del repository (clone
 * «shallow»), dove il conteggio sarebbe sbagliato: lì si prova a scaricare la storia completa. Se non riesce, o in
 * un'altra copia parziale, resta «0.1» e la build si riconosce da commit e ora.
 */
function appVersion(): string {
  const [major = '0', minor = '0'] = pkg.version.split('.')
  if (process.env.VERCEL && git('rev-parse --is-shallow-repository') === 'true') git('fetch --unshallow --quiet', 60_000)
  const count = git('rev-parse --is-shallow-repository') === 'false' ? git('rev-list --count HEAD') : ''
  return count ? `${major}.${minor}.${count}` : `${major}.${minor}`
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __APP_COMMIT__: JSON.stringify(git('rev-parse --short HEAD')),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
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
        globIgnores: ['**/push-worker.js'],
        navigateFallback: '/index.html',
        importScripts: ['push-worker.js'],
      },
    }),
  ],
  server: {
    // In sviluppo il server di sincronizzazione (server/main.py) gira a parte: Vite gli passa le chiamate /api.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
  },
})
