import { describe, expect, it } from 'vitest'
import { resolveSettingsAlert } from './navStatus'

const base = {
  syncEnabled: false,
  syncStatus: 'idle' as const,
  updateReady: false,
  reloadPending: false,
  backupReminderDue: false,
}

describe('resolveSettingsAlert', () => {
  it('restituisce null senza segnalazioni attive', () => {
    expect(resolveSettingsAlert(base)).toBeNull()
  })

  it('ignora syncStatus error quando la sincronizzazione è disabilitata', () => {
    expect(resolveSettingsAlert({ ...base, syncEnabled: false, syncStatus: 'error' })).toBeNull()
  })

  it('dà priorità massima all’errore di sincronizzazione', () => {
    expect(
      resolveSettingsAlert({
        syncEnabled: true,
        syncStatus: 'error',
        updateReady: true,
        reloadPending: true,
        backupReminderDue: true,
      }),
    ).toEqual({ kind: 'syncError', tone: 'negative' })
  })

  it('segnala aggiornamento pronto (updateReady o reloadPending) prima del backup', () => {
    expect(resolveSettingsAlert({ ...base, updateReady: true, backupReminderDue: true })).toEqual({
      kind: 'update',
      tone: 'accent',
    })
    expect(resolveSettingsAlert({ ...base, reloadPending: true, backupReminderDue: true })).toEqual({
      kind: 'update',
      tone: 'accent',
    })
  })

  it('segnala il promemoria backup quando non ci sono errori o aggiornamenti', () => {
    expect(resolveSettingsAlert({ ...base, backupReminderDue: true })).toEqual({
      kind: 'backup',
      tone: 'caution',
    })
  })
})
