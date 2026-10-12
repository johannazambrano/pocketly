import { get, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { addDays, hasUserData, isReminderDue, SNOOZE_DAYS, daysSince, type BackupMeta } from '@/domain/backupReminder'
import { useFinanceStore } from '@/stores/finance'
import { fingerprint, stableStringify } from '@/utils/hash'

const META_KEY = 'backup-meta'

/**
 * Tiene traccia di quando è stato fatto l'ultimo backup per ricordare di farne uno nuovo.
 * Resta fuori dai dati finanziari: non finisce nei file di backup e non cambia lo schema.
 */
export const useBackupStore = defineStore('backup', () => {
  const finance = useFinanceStore()
  const meta = ref<BackupMeta | null>(null)
  const currentHash = ref<string | null>(null)
  const now = ref(new Date())

  const computeHash = () => fingerprint(stableStringify(finance.data))

  async function persist() {
    try {
      await set(META_KEY, JSON.parse(JSON.stringify(meta.value)))
    } catch (e) {
      // Il promemoria è un di più: se non si riesce a salvare, l'app funziona lo stesso.
      console.error('Salvataggio dello stato dei backup non riuscito', e)
    }
  }

  async function init() {
    let stored: BackupMeta | undefined
    try {
      stored = await get<BackupMeta>(META_KEY)
    } catch {
      // archivio non leggibile: si riparte da zero
    }
    meta.value = stored ?? { startedAt: new Date().toISOString(), lastBackupAt: null, lastBackupHash: null, snoozedUntil: null }
    if (!stored) await persist()

    currentHash.value = computeHash()
    let timer: ReturnType<typeof setTimeout> | undefined
    watch(
      () => finance.data,
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => (currentHash.value = computeHash()), 500)
      },
      { deep: true },
    )
    // Chi lascia l'app aperta per giorni vede il promemoria comparire al rientro.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') now.value = new Date()
    })
  }

  /** Da chiamare dopo un backup esportato o un ripristino: da questo momento i dati risultano salvati. */
  async function markBackedUp() {
    if (!meta.value) return
    const at = new Date()
    now.value = at
    currentHash.value = computeHash()
    meta.value = { ...meta.value, lastBackupAt: at.toISOString(), lastBackupHash: currentHash.value, snoozedUntil: null }
    await persist()
  }

  async function snooze() {
    if (!meta.value) return
    meta.value = { ...meta.value, snoozedUntil: addDays(new Date(), SNOOZE_DAYS).toISOString() }
    await persist()
  }

  const lastBackupAt = computed(() => meta.value?.lastBackupAt ?? null)
  const daysSinceBackup = computed(() => (lastBackupAt.value ? daysSince(lastBackupAt.value, now.value) : null))
  /** Ci sono modifiche non ancora incluse in un backup. */
  const unsaved = computed(() => !!meta.value && currentHash.value !== null && meta.value.lastBackupHash !== currentHash.value)
  const reminderDue = computed(
    () =>
      !!meta.value &&
      currentHash.value !== null &&
      isReminderDue(meta.value, currentHash.value, hasUserData(finance.data), now.value),
  )
  /** Giorni di "ritardo" mostrati nel promemoria: dall'ultimo backup oppure, se non c'è mai stato, dall'inizio. */
  const daysOverdue = computed(() => (meta.value ? daysSince(meta.value.lastBackupAt ?? meta.value.startedAt, now.value) : 0))

  return { init, markBackedUp, snooze, lastBackupAt, daysSinceBackup, unsaved, reminderDue, daysOverdue }
})
