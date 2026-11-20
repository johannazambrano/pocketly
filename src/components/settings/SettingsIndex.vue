<script setup lang="ts">
import { computed } from 'vue'
import { useAppearanceStore } from '@/stores/appearance'
import { useBackupStore } from '@/stores/backup'
import { useFinanceStore } from '@/stores/finance'
import { useNotificationsStore } from '@/stores/notifications'
import { useSyncStore } from '@/stores/sync'
import { reloadPending, updateReady } from '@/composables/useAppUpdate'
import { LOCALES, useFormat } from '@/i18n'
import { SETTINGS_GROUPS, type SettingsIconTone, type SettingsSectionId } from '@/utils/settingsSections'

defineProps<{
  /** Sezione evidenziata come attiva nella colonna di destra su schermi larghi (`lg+`). */
  activeSection: SettingsSectionId
  /** Sezione esplicita nella rotta (`/impostazioni/:section`), `null` sull'indice. */
  currentSection: SettingsSectionId | null
}>()

const appearance = useAppearanceStore()
const backup = useBackupStore()
const finance = useFinanceStore()
const notifications = useNotificationsStore()
const sync = useSyncStore()
const { t, locale } = useFormat()

const version = __APP_VERSION__

const ICON_TONE_CLASS: Record<SettingsIconTone, string> = {
  accent: 'bg-accent-soft text-accent-icon',
  sync: 'bg-positive-soft text-sync',
  caution: 'bg-caution-soft text-caution-icon',
  recurring: 'bg-recurring-soft text-recurring',
  neutral: 'bg-surface-3 text-ink-3',
}

type AlertTone = 'negative' | 'caution' | 'accent'

const ALERT_DOT_CLASS: Record<AlertTone, string> = {
  negative: 'bg-negative-fill',
  caution: 'bg-caution-fill',
  accent: 'bg-accent-fill',
}

function formatCount(count: number): string {
  if (count === 0) return t('settings.index.countNone')
  if (count === 1) return t('settings.index.countOne')
  return t('settings.index.countMany', { count })
}

const backupStatus = computed(() => {
  if (!backup.lastBackupAt) return t('settings.index.backupNever')
  if (backup.unsaved) return t('settings.index.backupUnsaved')
  const days = backup.daysSinceBackup ?? 0
  const when = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }).format(-days, 'day')
  return t('settings.index.backupAgo', { when })
})

const syncStatus = computed(() => {
  if (sync.available === null) return t('app.loading')
  if (!sync.available) return t('settings.index.syncUnavailable')
  if (!sync.enabled) return t('settings.index.syncOff')
  return t(`sync.status.${sync.status}`)
})

const notificationsStatus = computed(() => {
  if (!notifications.isSupported) return t('settings.index.notificationsUnsupported')
  if (notifications.permission === 'denied') return t('settings.index.notificationsBlocked')
  if (!notifications.enabled) return t('settings.index.notificationsOff')
  return notifications.isPushActive ? t('settings.index.notificationsPush') : t('settings.index.notificationsLocal')
})

const appearanceStatus = computed(() => {
  const langLabel = LOCALES.find((l) => l.code === locale.value)?.label ?? locale.value
  const themeLabel = t(`settings.themes.${appearance.themeChoice}`)
  return `${langLabel} · ${themeLabel}`
})

const aboutStatus = computed(() =>
  updateReady.value || reloadPending.value
    ? t('settings.index.updateReady')
    : t('settings.index.versionShort', { version }),
)

const statusBySection = computed<Record<SettingsSectionId, string>>(() => ({
  dati: backupStatus.value,
  sincronizzazione: syncStatus.value,
  notifiche: notificationsStatus.value,
  categorie: formatCount(finance.data.categories.length),
  metodi: formatCount(finance.data.paymentMethods.length),
  tag: formatCount(finance.data.tags.length),
  'inserimenti-rapidi': formatCount(finance.quickExpenses.length),
  aspetto: appearanceStatus.value,
  informazioni: aboutStatus.value,
}))

const alertBySection = computed<Partial<Record<SettingsSectionId, AlertTone>>>(() => {
  const alerts: Partial<Record<SettingsSectionId, AlertTone>> = {}
  if (backup.reminderDue) alerts.dati = 'caution'
  if (sync.enabled && sync.status === 'error') alerts.sincronizzazione = 'negative'
  if (updateReady.value || reloadPending.value) alerts.informazioni = 'accent'
  return alerts
})

/**
 * Testo per i lettori di schermo al posto del pallino, che è solo visivo. Serve solo per «Dati e backup»: la riga di
 * stato («Ultimo backup 10 giorni fa») non dice che il backup è consigliato. Per sincronizzazione e aggiornamento la
 * riga di stato nomina già l'avviso («Sincronizzazione non riuscita», «Aggiornamento disponibile»).
 */
const alertLabelBySection = computed<Partial<Record<SettingsSectionId, string>>>(() =>
  alertBySection.value.dati ? { dati: t('nav.alerts.backup') } : {},
)

const groupTitleClass = computed(() => {
  if (appearance.platform === 'ios') return 'px-3 text-xs font-medium uppercase tracking-wide text-ink-4'
  if (appearance.platform === 'android') return 'px-3 text-xs font-medium text-accent'
  return 'px-2 text-xs font-semibold uppercase tracking-wide text-ink-4'
})

const groupListClass = computed(() => {
  if (appearance.platform === 'ios') return 'overflow-hidden rounded-[14px] bg-surface divide-y divide-line-soft'
  if (appearance.platform === 'android') return 'overflow-hidden rounded-2xl bg-surface divide-y divide-line-soft'
  return 'overflow-hidden rounded-xl border border-line bg-surface shadow-sm divide-y divide-line-soft'
})
</script>

<template>
  <nav :aria-label="t('settings.title')" class="space-y-4">
    <div v-for="group in SETTINGS_GROUPS" :key="group.id" class="space-y-1.5">
      <h3 :class="groupTitleClass">{{ t(group.titleKey) }}</h3>
      <ul :class="groupListClass">
        <li v-for="section in group.sections" :key="section.id">
          <RouterLink
            :to="{ name: 'settings-section', params: { section: section.id } }"
            class="flex min-h-13 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-icon"
            :class="
              activeSection === section.id
                ? 'lg:bg-accent-soft lg:text-accent'
                : 'text-ink'
            "
            :aria-current="currentSection === section.id ? 'page' : undefined"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
              :class="ICON_TONE_CLASS[section.iconTone]"
              aria-hidden="true"
            >
              <i class="fa-solid" :class="section.icon"></i>
            </span>

            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-sm font-medium"
                :class="activeSection === section.id ? 'lg:font-semibold lg:text-accent' : 'text-ink'"
              >
                {{ t(section.titleKey) }}
              </span>
              <span
                class="block truncate text-xs"
                :class="
                  alertBySection[section.id] === 'negative'
                    ? 'font-medium text-negative'
                    : alertBySection[section.id] === 'caution'
                      ? 'font-medium text-caution'
                      : alertBySection[section.id] === 'accent'
                        ? 'font-medium text-accent'
                        : 'text-ink-4'
                "
              >
                {{ statusBySection[section.id] }}
              </span>
            </span>

            <span
              v-if="alertBySection[section.id]"
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :class="ALERT_DOT_CLASS[alertBySection[section.id]!]"
              aria-hidden="true"
            ></span>
            <span v-if="alertLabelBySection[section.id]" class="sr-only">, {{ alertLabelBySection[section.id] }}</span>

            <i
              class="fa-solid fa-chevron-right shrink-0 text-xs text-ink-5 lg:hidden"
              aria-hidden="true"
            ></i>
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
