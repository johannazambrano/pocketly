<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useBackupStore } from '@/stores/backup'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useAppearanceStore, type PlatformChoice, type ThemeChoice } from '@/stores/appearance'
import { LOCALES, setLocale, useFormat, type LocaleCode } from '@/i18n'
import { canShareBackup, exportBackup, readBackupFile, type ExportMode } from '@/services/backup'
import { downloadOrShareCsv, generateCsv } from '@/services/csvExport'
import { CryptoUnavailableError, isCryptoAvailable, MIN_PASSWORD_LENGTH } from '@/services/backupCrypto'
import { NotExpenseTrackerError, readExcelFile, type ExcelImportResult, type ExcelImportStats, type ImportWarning } from '@/services/excelImport'
import { parseBackup } from '@/services/migration'
import { XlsxUnsupportedError } from '@/services/xlsx/zip'
import { formatDate } from '@/utils/dates'
import BaseModal from '@/components/BaseModal.vue'
import SyncSettings from '@/components/SyncSettings.vue'
import NotificationSettings from '@/components/NotificationSettings.vue'
import TagManager from '@/components/TagManager.vue'
import PageHeader from '@/components/PageHeader.vue'

const finance = useFinanceStore()
const backup = useBackupStore()
const ui = useUiStore()
const appearance = useAppearanceStore()
/** Aspetto e tema: di serie automatici, si possono fissare a mano (preferenze di questo dispositivo). */
const PLATFORM_CHOICES: PlatformChoice[] = ['auto', 'ios', 'android', 'desktop']
const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark']
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

/** "Riarmonizza i colori": sostituisce anche i colori scelti a mano, quindi si chiede prima. */
async function harmonize() {
  const ok = await ui.confirm({
    title: t('settings.harmonizeTitle'),
    message: t('settings.harmonizeMessage'),
    confirmLabel: t('settings.harmonize'),
  })
  if (!ok) return
  finance.harmonizeColors()
  ui.toast(t('settings.harmonizeDone'))
}

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

// --- esportazione CSV -----------------------------------------------------

const csvYear = ref<number | 'all'>(finance.selectedYear)
const csvBusy = ref(false)

async function doExportCsv(mode: 'download' | 'share') {
  if (csvBusy.value) return
  csvBusy.value = true
  try {
    const content = generateCsv(finance.data, {
      year: csvYear.value,
      locale: locale.value,
    })
    const dateStr = finance.today
    const suffix = csvYear.value === 'all' ? 'tutti-gli-anni' : String(csvYear.value)
    const filename = `pocketly-movimenti-${suffix}-${dateStr}.csv`
    const result = await downloadOrShareCsv(content, filename, mode)
    if (result === 'cancelled') return
    ui.toast(t(result === 'shared' ? 'csvExport.shared' : 'csvExport.downloaded'))
  } catch {
    ui.toast(t('csvExport.error'), 'error')
  } finally {
    csvBusy.value = false
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

// --- importazione da Excel ------------------------------------------------

const excelPreview = ref<ExcelImportResult | null>(null)
const COUNT_KEYS: (keyof ExcelImportStats)[] = ['oneTimeExpenses', 'recurringExpenses', 'incomes', 'categories', 'paymentMethods']

function excelErrorKey(e: unknown): string {
  if (e instanceof NotExpenseTrackerError) return 'excelImport.notTracker'
  if (e instanceof XlsxUnsupportedError) return 'excelImport.unsupported'
  if (e instanceof RangeError) return 'excelImport.tooLarge'
  return 'excelImport.error'
}

function warningText(w: ImportWarning): string {
  const params = { ...w.params }
  if (typeof params.date === 'string') params.date = formatDate(params.date, locale.value)
  return t(`excelImport.warnings.${w.code}`, params)
}

async function pickExcel(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  try {
    excelPreview.value = await readExcelFile(file)
  } catch (e) {
    console.error('Lettura del file Excel non riuscita', e)
    ui.toast(t(excelErrorKey(e)), 'error')
  } finally {
    busy.value = false
  }
}

async function confirmExcelImport() {
  const preview = excelPreview.value
  if (!preview || busy.value) return
  busy.value = true
  try {
    // Stesso controllo dei backup: i dati arrivano allo store già normalizzati.
    finance.replaceAll(parseBackup(JSON.parse(JSON.stringify(preview.data))))
    await finance.flush()
    excelPreview.value = null
    ui.toast(t('excelImport.success'))
  } catch (e) {
    console.error('Importazione da Excel non riuscita', e)
    ui.toast(t('excelImport.error'), 'error')
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
    <PageHeader :title="t('settings.title')" />

    <div class="lg:columns-2 lg:gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-ink-2">
          <i class="fa-solid fa-cloud-arrow-down mr-1 text-accent-icon"></i> {{ t('settings.backupTitle') }}
        </h3>
        <p class="text-xs text-ink-4">{{ t('settings.backupHint') }}</p>

        <div class="rounded-lg bg-surface-2 px-3 py-2 text-xs">
          <template v-if="backup.lastBackupAt">
            <p class="font-medium text-ink-2">{{ lastBackupText }}</p>
            <p v-if="backup.unsaved" class="text-caution"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('settings.unsavedChanges') }}</p>
            <p v-else class="text-accent"><i class="fa-solid fa-check mr-1"></i>{{ t('settings.allSaved') }}</p>
          </template>
          <p v-else class="text-caution"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('settings.neverBackedUp') }}</p>
        </div>

        <div class="space-y-2">
          <label class="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink-2" :class="cryptoAvailable ? '' : 'opacity-50'">
            <input v-model="protect" type="checkbox" class="h-4 w-4 accent-accent-icon" :disabled="!cryptoAvailable" />
            {{ t('settings.protect') }}
          </label>
          <p v-if="!cryptoAvailable" class="text-xs text-caution">{{ t('settings.cryptoUnavailable') }}</p>
          <div v-if="protect" class="space-y-2">
            <p class="text-xs text-ink-4">{{ t('settings.protectHint') }}</p>
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
            <p v-if="showPasswordProblem" class="text-xs text-negative" role="alert">{{ passwordProblem }}</p>
            <p class="text-xs text-caution"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('settings.passwordWarning') }}</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-primary min-w-40 flex-1" :disabled="busy || !!passwordProblem" @click="doExport(shareable ? 'share' : 'download')">
            {{ shareable ? t('settings.share') : t('settings.export') }}
          </button>
          <button
            v-if="shareable"
            type="button"
            class="min-h-10 min-w-40 flex-1 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-50"
            :disabled="busy || !!passwordProblem"
            @click="doExport('download')"
          >
            {{ t('settings.download') }}
          </button>
        </div>

        <label class="flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-chrome-2 px-4 py-2 text-center text-sm font-medium text-on-color focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-icon hover:bg-chrome-3" :class="busy ? 'pointer-events-none opacity-50' : ''">
          {{ t('settings.import') }}
          <input type="file" accept=".json,application/json" class="hidden" :disabled="busy" @change="importBackup" />
        </label>
      </div>

      <SyncSettings />
      <NotificationSettings />

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-ink-2">
          <i class="fa-solid fa-file-excel mr-1 text-accent-icon"></i> {{ t('excelImport.title') }}
        </h3>
        <p class="text-xs text-ink-4">{{ t('excelImport.hint') }}</p>
        <label class="flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-line-strong px-4 py-2 text-center text-sm font-medium text-ink-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-icon hover:bg-surface-2" :class="busy ? 'pointer-events-none opacity-50' : ''">
          {{ t('excelImport.choose') }}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            class="hidden"
            :disabled="busy"
            @change="pickExcel"
          />
        </label>
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-ink-2">
          <i class="fa-solid fa-file-csv mr-1 text-accent-icon"></i> {{ t('csvExport.title') }}
        </h3>
        <p class="text-xs text-ink-4">{{ t('csvExport.hint') }}</p>

        <label class="block">
          <span class="field-label">{{ t('csvExport.period') }}</span>
          <select v-model="csvYear" class="field">
            <option :value="finance.selectedYear">{{ t('csvExport.selectedYear', { year: finance.selectedYear }) }}</option>
            <option value="all">{{ t('csvExport.allYears') }}</option>
          </select>
        </label>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-primary min-w-40 flex-1"
            :disabled="csvBusy"
            @click="doExportCsv(shareable ? 'share' : 'download')"
          >
            {{ shareable ? t('csvExport.share') : t('csvExport.download') }}
          </button>
          <button
            v-if="shareable"
            type="button"
            class="min-h-10 min-w-40 flex-1 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-50"
            :disabled="csvBusy"
            @click="doExportCsv('download')"
          >
            {{ t('csvExport.download') }}
          </button>
        </div>
      </div>

      <TagManager kind="categories" :title="t('settings.categories')" :placeholder="t('settings.newCategory')" />
      <TagManager kind="paymentMethods" :title="t('settings.paymentMethods')" :placeholder="t('settings.newPayment')" />
      <TagManager kind="tags" :title="t('settings.tags')" :placeholder="t('settings.newTag')" />

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-ink-2"><i class="fa-solid fa-palette mr-1 text-recurring" aria-hidden="true"></i> {{ t('settings.colorsTitle') }}</h3>
        <p class="text-xs text-ink-4">{{ t('settings.colorsHint') }}</p>
        <button
          type="button"
          class="flex min-h-10 w-full items-center justify-center rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2"
          @click="harmonize"
        >
          {{ t('settings.harmonize') }}
        </button>
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-ink-2"><i class="fa-solid fa-language mr-1 text-recurring"></i> {{ t('settings.language') }}</h3>
        <div class="flex gap-2">
          <button
            v-for="l in LOCALES"
            :key="l.code"
            type="button"
            class="min-h-10 flex-1 rounded-lg border px-3 text-sm font-medium"
            :class="locale === l.code ? 'border-accent-icon bg-accent-soft text-accent' : 'border-line-strong text-ink-3'"
            @click="changeLocale(l.code)"
          >
            {{ l.label }}
          </button>
        </div>
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-ink-2"><i class="fa-solid fa-palette mr-1 text-recurring"></i> {{ t('settings.appearance') }}</h3>
        <div class="space-y-1">
          <p id="appearance-platform" class="text-xs font-medium text-ink-3">{{ t('settings.platform') }}</p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="appearance-platform">
            <button
              v-for="c in PLATFORM_CHOICES"
              :key="c"
              type="button"
              class="min-h-10 rounded-lg border px-3 text-sm font-medium"
              :class="appearance.platformChoice === c ? 'border-accent-icon bg-accent-soft text-accent' : 'border-line-strong text-ink-3'"
              :aria-pressed="appearance.platformChoice === c"
              @click="appearance.setPlatform(c)"
            >
              {{ t(`settings.platforms.${c}`) }}
            </button>
          </div>
          <p v-if="appearance.platformChoice === 'auto'" class="text-xs text-ink-4">
            {{ t('settings.platformDetected', { platform: t(`settings.platforms.${appearance.detected}`) }) }}
          </p>
        </div>
        <div class="space-y-1">
          <p id="appearance-theme" class="text-xs font-medium text-ink-3">{{ t('settings.theme') }}</p>
          <div class="grid grid-cols-3 gap-2" role="group" aria-labelledby="appearance-theme">
            <button
              v-for="c in THEME_CHOICES"
              :key="c"
              type="button"
              class="min-h-10 rounded-lg border px-3 text-sm font-medium"
              :class="appearance.themeChoice === c ? 'border-accent-icon bg-accent-soft text-accent' : 'border-line-strong text-ink-3'"
              :aria-pressed="appearance.themeChoice === c"
              @click="appearance.setTheme(c)"
            >
              {{ t(`settings.themes.${c}`) }}
            </button>
          </div>
        </div>
      </div>

      <div class="card space-y-2 text-xs text-ink-4">
        <h3 class="text-sm font-semibold text-ink-2"><i class="fa-solid fa-shield-halved mr-1 text-ink-3"></i> {{ t('settings.privacyTitle') }}</h3>
        <p>{{ t('settings.privacyText') }}</p>
        <p v-if="persistent === true" class="text-accent"><i class="fa-solid fa-check mr-1"></i>{{ t('settings.storagePersistent') }}</p>
        <p v-else-if="persistent === false" class="text-caution"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('settings.storageNotPersistent') }}</p>
        <p class="pt-2 text-[11px] text-ink-4">{{ t('settings.version', { version }) }}</p>
      </div>
    </div>

    <BaseModal :open="!!unlock" :title="t('settings.unlockTitle')" @close="answerUnlock(null)">
      <form class="space-y-3" @submit.prevent="answerUnlock(unlockPassword)">
        <p class="text-sm text-ink-3">{{ t('settings.unlockText') }}</p>
        <input
          v-model="unlockPassword"
          type="password"
          autocomplete="current-password"
          class="field"
          :aria-label="t('settings.password', { min: MIN_PASSWORD_LENGTH })"
        />
        <p v-if="unlock?.retry" class="text-xs text-negative" role="alert">{{ t('settings.unlockWrong') }}</p>
        <div class="flex gap-2">
          <button type="button" class="min-h-10 flex-1 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink-2 hover:bg-surface-2" @click="answerUnlock(null)">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn-primary flex-1" :disabled="!unlockPassword">{{ t('settings.unlockButton') }}</button>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="!!excelPreview" :title="t('excelImport.previewTitle')" @close="excelPreview = null">
      <div v-if="excelPreview" class="space-y-3">
        <dl class="divide-y divide-line-soft rounded-lg bg-surface-2 px-3 text-sm">
          <div v-for="key in COUNT_KEYS" :key="key" class="flex justify-between py-1.5">
            <dt class="text-ink-3">{{ t(`excelImport.counts.${key}`) }}</dt>
            <dd class="font-semibold text-ink tabular-nums">{{ excelPreview.stats[key] }}</dd>
          </div>
        </dl>
        <details v-if="excelPreview.warnings.length" class="rounded-lg border border-caution-line bg-caution-soft px-3 py-2 text-xs text-caution-strong">
          <summary class="cursor-pointer font-medium">
            <i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('excelImport.warningsTitle', { count: excelPreview.warnings.length }) }}
          </summary>
          <ul class="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-4">
            <li v-for="(w, i) in excelPreview.warnings" :key="i">{{ warningText(w) }}</li>
          </ul>
        </details>
        <p class="text-xs text-ink-3">{{ t('excelImport.replaceWarning') }}</p>
        <div class="flex gap-2">
          <button type="button" class="min-h-10 flex-1 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink-2 hover:bg-surface-2" @click="excelPreview = null">
            {{ t('common.cancel') }}
          </button>
          <button type="button" class="btn-primary flex-1" :disabled="busy" @click="confirmExcelImport">{{ t('excelImport.confirm') }}</button>
        </div>
      </div>
    </BaseModal>
  </section>
</template>
