<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const ui = useUiStore()

let cleanupListeners: (() => void) | null = null
onUnmounted(() => {
  cleanupListeners?.()
})

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    // Monitora il ciclo di vita del worker in installazione
    const trackWorker = (worker: ServiceWorker | null) => {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          needRefresh.value = true
        }
      })
    }

    // 1. Se un worker è già in attesa o in installazione, mostra subito l'aggiornamento
    if (registration.waiting) {
      needRefresh.value = true
    } else if (registration.installing) {
      trackWorker(registration.installing)
    }

    // 2. Ascolto diretto di nuovi worker trovati (non soggetto a rimozione o timeout di Workbox)
    registration.addEventListener('updatefound', () => {
      trackWorker(registration.installing)
    })

    // 3. Funzione di verifica aggiornamenti idempotente
    const checkForUpdate = async () => {
      if (!(navigator.onLine ?? true)) return
      try {
        if (registration.waiting) {
          needRefresh.value = true
          return
        }
        await registration.update()
        if (registration.waiting) {
          needRefresh.value = true
        }
      } catch (error) {
        console.warn('Controllo aggiornamenti PWA non riuscito:', error)
      }
    }

    // Controllo iniziale all'avvio
    void checkForUpdate()

    // 4. Multi-trigger per risveglio su Safari iOS e desktop:
    // Su iOS Safari standalone il processo viene spesso congelato senza emettere visibilitychange;
    // pageshow e focus si attivano invece al ripristino dell'app.
    const onWakeOrFocus = () => {
      if (document.visibilityState === 'visible' && (navigator.onLine ?? true)) {
        void checkForUpdate()
      }
    }

    document.addEventListener('visibilitychange', onWakeOrFocus)
    window.addEventListener('pageshow', onWakeOrFocus)
    window.addEventListener('focus', onWakeOrFocus)
    window.addEventListener('online', onWakeOrFocus)

    // 5. Controllo periodico ogni 15 minuti mentre l'app è aperta
    const intervalTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && (navigator.onLine ?? true)) {
        void checkForUpdate()
      }
    }, 15 * 60 * 1000)

    // 6. Rilevamento risveglio da sospensione profonda iOS (heartbeat delta)
    // Se passano più di 5 secondi tra due tick da 2 secondi, l'iPhone ha congelato il processo.
    let lastTick = Date.now()
    const heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (now - lastTick > 5000) {
        void checkForUpdate()
      }
      lastTick = now
    }, 2000)

    cleanupListeners = () => {
      document.removeEventListener('visibilitychange', onWakeOrFocus)
      window.removeEventListener('pageshow', onWakeOrFocus)
      window.removeEventListener('focus', onWakeOrFocus)
      window.removeEventListener('online', onWakeOrFocus)
      clearInterval(intervalTimer)
      clearInterval(heartbeatTimer)
    }
  },
  onRegisterError(error) {
    console.error('PWA registration error:', error)
  },
})

// Garantisce che al subentro del nuovo Service Worker la pagina si ricarichi una sola volta
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true
      window.location.reload()
    }
  })
}

watch(offlineReady, (ready) => {
  if (ready) ui.toast(t('app.offlineReady'))
})
</script>

<template>
  <div
    v-if="needRefresh"
    class="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-chrome px-4 py-3 text-sm text-on-color shadow-lg md:bottom-6"
  >
    <div class="flex items-center gap-2">
      <i class="fa-solid fa-arrows-rotate text-accent-light"></i>
      <span>{{ t('app.updateAvailable') }}</span>
    </div>
    <button type="button" class="btn-primary" @click="updateServiceWorker(true)">{{ t('app.update') }}</button>
  </div>
</template>
