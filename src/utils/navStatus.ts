import type { SyncStatus } from '@/stores/sync'

export type NavAlertKind = 'syncError' | 'update' | 'backup'
export type NavAlertTone = 'negative' | 'accent' | 'caution'

export interface NavAlert {
  kind: NavAlertKind
  tone: NavAlertTone
}

export interface SettingsAlertInput {
  syncEnabled: boolean
  syncStatus: SyncStatus
  updateReady: boolean
  reloadPending: boolean
  backupReminderDue: boolean
}

/** Determina l'eventuale avviso prioritario da mostrare su Impostazioni / Altro nella navigazione. */
export function resolveSettingsAlert(input: SettingsAlertInput): NavAlert | null {
  if (input.syncEnabled && input.syncStatus === 'error') return { kind: 'syncError', tone: 'negative' }
  if (input.updateReady || input.reloadPending) return { kind: 'update', tone: 'accent' }
  if (input.backupReminderDue) return { kind: 'backup', tone: 'caution' }
  return null
}
