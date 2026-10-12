import { describe, expect, it } from 'vitest'
import { createDefaultData } from '@/domain/defaults'
import { addDays, daysSince, hasUserData, isReminderDue, REMINDER_DAYS, type BackupMeta } from './backupReminder'

const NOW = new Date('2026-10-12T10:00:00.000Z')
const ago = (days: number) => addDays(NOW, -days).toISOString()

const meta = (over: Partial<BackupMeta> = {}): BackupMeta => ({
  startedAt: ago(30),
  lastBackupAt: ago(10),
  lastBackupHash: 'vecchio',
  snoozedUntil: null,
  ...over,
})

describe('daysSince', () => {
  it('conta i giorni interi', () => {
    expect(daysSince(ago(0), NOW)).toBe(0)
    expect(daysSince(ago(3.5), NOW)).toBe(3)
    expect(daysSince(ago(10), NOW)).toBe(10)
  })
  it('non va sotto zero e tollera date non valide', () => {
    expect(daysSince(addDays(NOW, 2).toISOString(), NOW)).toBe(0)
    expect(daysSince('boh', NOW)).toBe(0)
  })
})

describe('hasUserData', () => {
  it('le sole categorie predefinite non contano', () => {
    expect(hasUserData(createDefaultData('it'))).toBe(false)
  })
})

describe('isReminderDue', () => {
  it('scatta dopo i giorni previsti se i dati sono cambiati', () => {
    expect(isReminderDue(meta({ lastBackupAt: ago(REMINDER_DAYS) }), 'nuovo', true, NOW)).toBe(true)
    expect(isReminderDue(meta({ lastBackupAt: ago(REMINDER_DAYS - 1) }), 'nuovo', true, NOW)).toBe(false)
  })
  it('non scatta se non c’è nulla di nuovo da salvare', () => {
    expect(isReminderDue(meta({ lastBackupHash: 'uguale' }), 'uguale', true, NOW)).toBe(false)
  })
  it('non scatta se non ci sono dati inseriti', () => {
    expect(isReminderDue(meta(), 'nuovo', false, NOW)).toBe(false)
  })
  it('senza backup parte dal primo avvio', () => {
    const never = { lastBackupAt: null, lastBackupHash: null }
    expect(isReminderDue(meta({ ...never, startedAt: ago(2) }), 'nuovo', true, NOW)).toBe(false)
    expect(isReminderDue(meta({ ...never, startedAt: ago(8) }), 'nuovo', true, NOW)).toBe(true)
  })
  it('tace finché dura il "Più tardi"', () => {
    expect(isReminderDue(meta({ snoozedUntil: addDays(NOW, 1).toISOString() }), 'nuovo', true, NOW)).toBe(false)
    expect(isReminderDue(meta({ snoozedUntil: addDays(NOW, -1).toISOString() }), 'nuovo', true, NOW)).toBe(true)
  })
})
