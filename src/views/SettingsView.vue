<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { LOCALES, setLocale, useFormat, type LocaleCode } from '@/i18n'
import { downloadBackup, readBackupFile } from '@/services/backup'
import TagManager from '@/components/TagManager.vue'

const finance = useFinanceStore()
const ui = useUiStore()
const { t, locale } = useFormat()
const version = __APP_VERSION__

const persistent = ref<boolean | null>(null)
onMounted(async () => {
  try {
    persistent.value = (await navigator.storage?.persisted?.()) ?? false
  } catch {
    persistent.value = false
  }
})

function exportBackup() {
  downloadBackup(finance.data)
  ui.toast(t('settings.exportSuccess'))
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const ok = await ui.confirm({
    title: t('settings.importConfirmTitle'),
    message: t('settings.importConfirm'),
    confirmLabel: t('settings.importConfirmButton'),
  })
  if (!ok) return
  try {
    finance.replaceAll(await readBackupFile(file))
    await finance.flush()
    ui.toast(t('settings.importSuccess'))
  } catch {
    ui.toast(t('settings.importError'), 'error')
  }
}

function changeLocale(code: LocaleCode) {
  setLocale(code)
}
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-bold text-slate-800">{{ t('settings.title') }}</h2>

    <div class="lg:columns-2 lg:gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">
          <i class="fa-solid fa-cloud-arrow-down mr-1 text-emerald-600"></i> {{ t('settings.backupTitle') }}
        </h3>
        <p class="text-xs text-slate-500">{{ t('settings.backupHint') }}</p>
        <div class="flex gap-2">
          <button type="button" class="btn-primary flex-1" @click="exportBackup">
            {{ t('settings.export') }}
          </button>
          <label class="flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-center text-sm font-medium text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-600 hover:bg-slate-700">
            {{ t('settings.import') }}
            <input type="file" accept=".json,application/json" class="hidden" @change="importBackup" />
          </label>
        </div>
      </div>

      <TagManager kind="categories" :title="t('settings.categories')" :placeholder="t('settings.newCategory')" />
      <TagManager kind="paymentMethods" :title="t('settings.paymentMethods')" :placeholder="t('settings.newPayment')" />

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-slate-700"><i class="fa-solid fa-language mr-1 text-indigo-600"></i> {{ t('settings.language') }}</h3>
        <div class="flex gap-2">
          <button
            v-for="l in LOCALES"
            :key="l.code"
            type="button"
            class="min-h-10 flex-1 rounded-lg border px-3 text-sm font-medium"
            :class="locale === l.code ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600'"
            @click="changeLocale(l.code)"
          >
            {{ l.label }}
          </button>
        </div>
      </div>

      <div class="card space-y-2 text-xs text-slate-500">
        <h3 class="text-sm font-semibold text-slate-700"><i class="fa-solid fa-shield-halved mr-1 text-slate-600"></i> {{ t('settings.privacyTitle') }}</h3>
        <p>{{ t('settings.privacyText') }}</p>
        <p v-if="persistent === true" class="text-emerald-700"><i class="fa-solid fa-check mr-1"></i>{{ t('settings.storagePersistent') }}</p>
        <p v-else-if="persistent === false" class="text-amber-700"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('settings.storageNotPersistent') }}</p>
        <p class="pt-2 text-[11px] text-slate-400">{{ t('settings.version', { version }) }}</p>
      </div>
    </div>
  </section>
</template>
