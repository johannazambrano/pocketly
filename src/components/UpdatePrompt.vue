<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()

watch(offlineReady, (ready) => {
  if (ready) ui.toast(t('app.offlineReady'))
})
</script>

<template>
  <div
    v-if="needRefresh"
    class="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg md:bottom-6"
  >
    <span>{{ t('app.updateAvailable') }}</span>
    <button type="button" class="btn-primary" @click="updateServiceWorker(true)">{{ t('app.update') }}</button>
  </div>
</template>
