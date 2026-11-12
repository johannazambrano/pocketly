<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useUiStore } from '@/stores/ui'
import {
  applyUpdate,
  attachRegistration,
  checkForUpdate,
  onControllerChange,
  reloadPending,
  updateReady,
} from '@/composables/useAppUpdate'

const { t } = useI18n()
const ui = useUiStore()

/** Tra due controlli fatti al risveglio passa almeno questo tempo: `focus` al PC scatta di continuo. */
const MIN_CHECK_GAP_MS = 60 * 1000

let cleanupListeners: (() => void) | null = null
onUnmounted(() => {
  cleanupListeners?.()
})

const { needRefresh, offlineReady } = useRegisterSW({
  immediate: true,
  // Workbox ricaricherebbe ogni finestra che ha visto l'avviso: decide invece useAppUpdate.
  onNeedReload: onControllerChange,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    attachRegistration(registration)

    let lastCheck = 0
    const check = (force = false) => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (!force && now - lastCheck < MIN_CHECK_GAP_MS) return
      lastCheck = now
      void checkForUpdate()
    }

    // Controllo all'avvio (trova anche un worker già in attesa da una visita precedente).
    check(true)

    // Su iPhone, con l'app aperta dalla Home, il risveglio non sempre manda `visibilitychange`:
    // `pageshow` e `focus` arrivano invece al ripristino.
    const onWake = () => check()
    const onOnline = () => check(true)
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('pageshow', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('online', onOnline)

    // Controllo periodico ogni 15 minuti mentre l'app è in vista.
    const intervalTimer = setInterval(() => check(true), 15 * 60 * 1000)

    // Risveglio dalla sospensione su iPhone: se tra due battiti da 2 secondi ne passano più di 5,
    // il processo era congelato. Con l'app nascosta non si controlla (al PC e su Android il browser
    // rallenta i timer delle schede in sottofondo, e sembrerebbe sempre un risveglio).
    let lastTick = Date.now()
    const heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (now - lastTick > 5000) check()
      lastTick = now
    }, 2000)

    cleanupListeners = () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('pageshow', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('online', onOnline)
      clearInterval(intervalTimer)
      clearInterval(heartbeatTimer)
    }
  },
  onRegisterError(error) {
    console.error('PWA registration error:', error)
  },
})

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
}

watch(needRefresh, (ready) => {
  if (ready) updateReady.value = true
})

watch(offlineReady, (ready) => {
  if (ready) ui.toast(t('app.offlineReady'))
})
</script>

<template>
  <div
    v-if="updateReady || reloadPending"
    role="status"
    class="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-chrome px-4 py-3 text-sm text-on-color shadow-lg md:bottom-6"
  >
    <div class="flex items-center gap-2">
      <i class="fa-solid fa-arrows-rotate text-accent-light" aria-hidden="true"></i>
      <span>{{ t('app.updateAvailable') }}</span>
    </div>
    <button type="button" class="btn-primary" @click="applyUpdate">{{ t('app.update') }}</button>
  </div>
</template>
