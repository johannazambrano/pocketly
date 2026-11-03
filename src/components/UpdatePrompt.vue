<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const ui = useUiStore()

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    // 1. Controllo immediato all'avvio dell'app
    void registration.update()

    // 2. Controllo al ritorno in primo piano (es. sblocco iPhone, riapertura da schermata Home o cambio app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (navigator.onLine ?? true)) {
        void registration.update()
      }
    })

    // 3. Controllo al ripristino della connettività di rete
    window.addEventListener('online', () => {
      void registration.update()
    })

    // 4. Controllo periodico ogni 15 minuti mentre l'app è aperta
    setInterval(() => {
      if (document.visibilityState === 'visible' && (navigator.onLine ?? true)) {
        void registration.update()
      }
    }, 15 * 60 * 1000)
  },
  onRegisterError(error) {
    console.error('PWA registration error:', error)
  },
})

watch(offlineReady, (ready) => {
  if (ready) ui.toast(t('app.offlineReady'))
})
</script>

<template>
  <div
    v-if="needRefresh"
    class="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg md:bottom-6"
  >
    <div class="flex items-center gap-2">
      <i class="fa-solid fa-arrows-rotate text-emerald-400"></i>
      <span>{{ t('app.updateAvailable') }}</span>
    </div>
    <button type="button" class="btn-primary" @click="updateServiceWorker(true)">{{ t('app.update') }}</button>
  </div>
</template>
