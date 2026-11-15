<script setup lang="ts">
/**
 * Al posto delle pagine quando i dati salvati su questo dispositivo non si leggono (`finance.loadError`). L'app non ha
 * scritto niente sopra: qui si può riprovare (dopo un aggiornamento, di solito, passa) o scaricare i dati così come
 * sono, per non perderli.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { readStoredDataRaw } from '@/services/storage'
import { todayIso } from '@/utils/dates'

const { t } = useI18n()
const nothing = ref(false)

function retry() {
  window.location.reload()
}

async function download() {
  const raw = await readStoredDataRaw().catch(() => null)
  if (raw === null) {
    nothing.value = true
    return
  }
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `pocketly-dati-salvati-${todayIso()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <section class="card mx-auto mt-6 max-w-md space-y-4" role="alert">
    <div class="flex items-start gap-3">
      <i class="fa-solid fa-triangle-exclamation mt-1 text-lg text-caution" aria-hidden="true"></i>
      <div class="space-y-2">
        <h2 class="text-lg font-semibold text-ink">{{ t('app.loadErrorTitle') }}</h2>
        <p class="text-sm text-ink-2">{{ t('app.loadErrorText') }}</p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn-primary flex-1" @click="retry">{{ t('app.loadErrorRetry') }}</button>
      <button
        type="button"
        class="flex min-h-10 flex-1 items-center justify-center rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2"
        @click="download"
      >
        {{ t('app.loadErrorDownload') }}
      </button>
    </div>
    <p class="text-xs text-ink-3">{{ nothing ? t('app.loadErrorNothing') : t('app.loadErrorDownloadHint') }}</p>
  </section>
</template>
