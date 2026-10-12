<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useBackupStore } from '@/stores/backup'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { LOCALES, setLocale, useFormat, type LocaleCode } from '@/i18n'
import { canShareBackup, exportBackup, readBackupFile, type ExportMode } from '@/services/backup'
import { CryptoUnavailableError, isCryptoAvailable, MIN_PASSWORD_LENGTH } from '@/services/backupCrypto'
import BaseModal from '@/components/BaseModal.vue'
import TagManager from '@/components/TagManager.vue'

const finance = useFinanceStore()
const backup = useBackupStore()
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

// --- esportazione ---------------------------------------------------------

const shareable = canShareBackup()
const cryptoAvailable = isCryptoAvailable()
const protect = ref(false)
const password = ref('')
const passwordRepeat = ref('')
const busy = ref(false)

const passwordProblem = computed(() => {
  if (!protect.value) return ''
  if (password.value.length < MIN_PASSWORD_LENGTH) return t('settings.passwordTooShort', { min: MIN_PASSWORD_LENGTH })
  if (password.value !== passwordRepeat.value) return t('settings.passwordMismatch')
  return ''
})
const showPasswordProblem = computed(() => !!passwordProblem.value && (!!password.value || !!passwordRepeat.value))

const lastBackupText = computed(() => {
  const days = backup.daysSinceBackup
  if (days === null) return ''
  const when = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }).format(-days, 'day')
  return t('settings.lastBackup', { when })
})

async function doExport(mode: ExportMode) {
  if (busy.value || passwordProblem.value) return
  busy.value = true
  try {
    const result = await exportBackup(finance.data, mode, protect.value ? password.value : undefined)
    if (result === 'cancelled') return
    await backup.markBackedUp()
    ui.toast(t(result === 'shared' ? 'settings.exportShared' : 'settings.exportSuccess'))
    password.value = ''
    passwordRepeat.value = ''
  } catch (e) {
    ui.toast(t(e instanceof CryptoUnavailableError ? 'settings.cryptoUnavailable' : 'settings.exportError'), 'error')
  } finally {
    busy.value = false
  }
}

// --- importazione ---------------------------------------------------------

const unlock = ref<{ retry: boolean; resolve: (password: string | null) => void } | null>(null)
const unlockPassword = ref('')

function askPassword(retry: boolean) {
  return new Promise<string | null>((resolve) => {
    unlockPassword.value = ''
    unlock.value = { retry, resolve }
  })
}

function answerUnlock(value: string | null) {
  unlock.value?.resolve(value)
  unlock.value = null
  unlockPassword.value = ''
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
  busy.value = true
  try {
    const restored = await readBackupFile(file, askPassword)
    if (!restored) return
    finance.replaceAll(restored)
    await finance.flush()
    await backup.markBackedUp()
    ui.toast(t('settings.importSuccess'))
  } catch (e) {
    ui.toast(t(e instanceof CryptoUnavailableError ? 'settings.cryptoUnavailable' : 'settings.importError'), 'error')
  } finally {
    busy.value = false
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

        <div class="rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <template v-if="backup.lastBackupAt">
            <p class="font-medium text-slate-700">{{ lastBackupText }}</p>
            <p v-if="backup.unsaved" class="text-amber-700"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('settings.unsavedChanges') }}</p>
            <p v-else class="text-emerald-700"><i class="fa-solid fa-check mr-1"></i>{{ t('settings.allSaved') }}</p>
          </template>
          <p v-else class="text-amber-700"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('settings.neverBackedUp') }}</p>
        </div>

        <div class="space-y-2">
          <label class="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700" :class="cryptoAvailable ? '' : 'opacity-50'">
            <input v-model="protect" type="checkbox" class="h-4 w-4 accent-emerald-600" :disabled="!cryptoAvailable" />
            {{ t('settings.protect') }}
          </label>
          <p v-if="!cryptoAvailable" class="text-xs text-amber-700">{{ t('settings.cryptoUnavailable') }}</p>
          <div v-if="protect" class="space-y-2">
            <p class="text-xs text-slate-500">{{ t('settings.protectHint') }}</p>
            <input
              v-model="password"
              type="password"
              autocomplete="new-password"
              class="field"
              :placeholder="t('settings.password', { min: MIN_PASSWORD_LENGTH })"
              :aria-label="t('settings.password', { min: MIN_PASSWORD_LENGTH })"
            />
            <input
              v-model="passwordRepeat"
              type="password"
              autocomplete="new-password"
              class="field"
              :placeholder="t('settings.passwordRepeat')"
              :aria-label="t('settings.passwordRepeat')"
            />
            <p v-if="showPasswordProblem" class="text-xs text-rose-600" role="alert">{{ passwordProblem }}</p>
            <p class="text-xs text-amber-700"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('settings.passwordWarning') }}</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-primary min-w-40 flex-1" :disabled="busy || !!passwordProblem" @click="doExport(shareable ? 'share' : 'download')">
            {{ shareable ? t('settings.share') : t('settings.export') }}
          </button>
          <button
            v-if="shareable"
            type="button"
            class="min-h-10 min-w-40 flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            :disabled="busy || !!passwordProblem"
            @click="doExport('download')"
          >
            {{ t('settings.download') }}
          </button>
        </div>

        <label class="flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-center text-sm font-medium text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-600 hover:bg-slate-700" :class="busy ? 'pointer-events-none opacity-50' : ''">
          {{ t('settings.import') }}
          <input type="file" accept=".json,application/json" class="hidden" :disabled="busy" @change="importBackup" />
        </label>
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

    <BaseModal :open="!!unlock" :title="t('settings.unlockTitle')" @close="answerUnlock(null)">
      <form class="space-y-3" @submit.prevent="answerUnlock(unlockPassword)">
        <p class="text-sm text-slate-600">{{ t('settings.unlockText') }}</p>
        <input
          v-model="unlockPassword"
          type="password"
          autocomplete="current-password"
          class="field"
          :aria-label="t('settings.password', { min: MIN_PASSWORD_LENGTH })"
        />
        <p v-if="unlock?.retry" class="text-xs text-rose-600" role="alert">{{ t('settings.unlockWrong') }}</p>
        <div class="flex gap-2">
          <button type="button" class="min-h-10 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" @click="answerUnlock(null)">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn-primary flex-1" :disabled="!unlockPassword">{{ t('settings.unlockButton') }}</button>
        </div>
      </form>
    </BaseModal>
  </section>
</template>
