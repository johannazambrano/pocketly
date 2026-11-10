import { describe, expect, it } from 'vitest'
import type { RecurringExpense } from '@/types/models'
import {
  calculateDueLocalReminders,
  calculateUpcomingReminders,
  formatReminderMessage,
  formatRuleShort,
  formatRulesSummary,
  nextCandidateRule,
  normalizeNotifications,
  occurrencesBetween,
  reminderTriggerDate,
  shiftIsoDate,
} from './notifications'

const rec = (over: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id: 'rec-1',
  name: 'Affitto',
  amount: 50000,
  frequency: 'monthly',
  startDate: '2026-01-15',
  endDate: null,
  categoryId: 'cat-1',
  paymentMethodId: 'pm-1',
  ...over,
})

describe('normalizeNotifications', () => {
  it('scarta regole malformate, deduplica e ordina in modo canonico', () => {
    const raw = [
      { daysBefore: 0, time: '09:00' },
      { daysBefore: 3, time: '18:00' },
      { daysBefore: 3, time: '08:30' },
      { daysBefore: 0, time: '09:00' }, // duplicato
      { daysBefore: -1, time: '09:00' }, // negativo
      { daysBefore: 400, time: '09:00' }, // oltre 365
      { daysBefore: 1.5, time: '09:00' }, // non intero
      { daysBefore: 1, time: '25:00' }, // ora non valida
      { daysBefore: 1, time: '9:00' }, // formato non HH:MM
      null,
      'invalido',
    ]
    expect(normalizeNotifications(raw)).toEqual([
      { daysBefore: 3, time: '08:30' },
      { daysBefore: 3, time: '18:00' },
      { daysBefore: 0, time: '09:00' },
    ])
  })

  it('restituisce array vuoto per valori non array', () => {
    expect(normalizeNotifications(undefined)).toEqual([])
    expect(normalizeNotifications(null)).toEqual([])
    expect(normalizeNotifications({})).toEqual([])
  })
})

describe('nextCandidateRule', () => {
  it('propone una regola non ancora presente', () => {
    const r1 = nextCandidateRule([])
    expect(r1).toEqual({ daysBefore: 1, time: '09:00' })
    const r2 = nextCandidateRule([r1])
    expect(r2).toEqual({ daysBefore: 0, time: '09:00' })
    const r3 = nextCandidateRule([r1, r2])
    expect(r3).toEqual({ daysBefore: 3, time: '09:00' })
  })
})

describe('shiftIsoDate & reminderTriggerDate', () => {
  it('gestisce cambi di mese e anni bisestili', () => {
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftIsoDate('2024-03-01', -1)).toBe('2024-02-29')
    const trigger = reminderTriggerDate('2026-03-01', { daysBefore: 2, time: '09:30' })
    expect(trigger.getFullYear()).toBe(2026)
    expect(trigger.getMonth()).toBe(1) // febbraio
    expect(trigger.getDate()).toBe(27)
    expect(trigger.getHours()).toBe(9)
    expect(trigger.getMinutes()).toBe(30)
  })
})

describe('occurrencesBetween', () => {
  it('elenca tutti gli addebiti mensili nell’intervallo', () => {
    const r = rec({ startDate: '2026-01-31' })
    expect(occurrencesBetween(r, '2026-02-01', '2026-05-15')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('rispetta la data di fine', () => {
    const r = rec({ startDate: '2026-01-10', endDate: '2026-03-10' })
    expect(occurrencesBetween(r, '2026-01-01', '2026-06-01')).toEqual([
      '2026-01-10',
      '2026-02-10',
      '2026-03-10',
    ])
  })
})

describe('calculateUpcomingReminders & calculateDueLocalReminders', () => {
  it('calcola i promemoria futuri entro l’orizzonte indicato', () => {
    const r = rec({
      id: 'affitto',
      name: 'Affitto',
      amount: 60000,
      startDate: '2026-01-15',
      notifications: [
        { daysBefore: 2, time: '09:00' },
        { daysBefore: 0, time: '08:00' },
      ],
    })
    const now = new Date(2026, 10, 10, 12, 0, 0) // 10 novembre 2026 ore 12:00
    const reminders = calculateUpcomingReminders([r], now, 30)
    expect(reminders.map((x) => ({ id: x.id, dueDate: x.dueDate, daysBefore: x.daysBefore }))).toEqual([
      { id: 'affitto:2026-11-15:2:09:00', dueDate: '2026-11-15', daysBefore: 2 },
      { id: 'affitto:2026-11-15:0:08:00', dueDate: '2026-11-15', daysBefore: 0 },
    ])
  })

  it('individua i promemoria maturati nelle ultime 24 ore per il motore locale', () => {
    const r = rec({
      id: 'netflix',
      name: 'Netflix',
      amount: 1799,
      startDate: '2026-01-15',
      notifications: [{ daysBefore: 1, time: '09:00' }],
    })
    // Il 14 novembre alle 10:30 il promemoria delle 09:00 (1 giorno prima del 15 nov) è maturato da 1h30m.
    const now = new Date(2026, 10, 14, 10, 30, 0)
    const due = calculateDueLocalReminders([r], now, 24)
    expect(due).toHaveLength(1)
    expect(due[0]!.id).toBe('netflix:2026-11-15:1:09:00')
  })
})

describe('formatReminderMessage & formatRuleShort & formatRulesSummary', () => {
  const dummyT = (key: string, values?: Record<string, unknown>) => {
    if (key === 'notifications.pushMessage.title') return `${values?.name} in scadenza`
    if (key === 'notifications.pushMessage.bodyToday') return `Oggi addebito di ${values?.amount}`
    if (key === 'notifications.pushMessage.bodyTomorrow') return `Domani (${values?.date}) addebito di ${values?.amount}`
    if (key === 'notifications.pushMessage.bodyInDays') return `Tra ${values?.days} giorni (${values?.date}) addebito di ${values?.amount}`
    if (key === 'notifications.shortBadge.d0') return `giorno stesso (${values?.time})`
    if (key === 'notifications.shortBadge.d1') return `1g prima (${values?.time})`
    if (key === 'notifications.shortBadge.d7') return `1 sett. prima (${values?.time})`
    if (key === 'notifications.shortBadge.d14') return `2 sett. prima (${values?.time})`
    if (key === 'notifications.shortBadge.days') return `${values?.n}g prima (${values?.time})`
    return key
  }

  it('formatta correttamente i messaggi di notifica per 0, 1 e N giorni prima', () => {
    const baseReminder = {
      id: '1:2026-05-10:0:09:00',
      expenseId: '1',
      expenseName: 'Palestra',
      amount: 4500,
      dueDate: '2026-05-10',
      daysBefore: 0,
      time: '09:00',
      fireAt: 1000,
    }
    expect(formatReminderMessage(baseReminder, dummyT, '45,00 €', '10/05/2026')).toEqual({
      title: 'Palestra in scadenza',
      body: 'Oggi addebito di 45,00 €',
    })

    expect(formatReminderMessage({ ...baseReminder, daysBefore: 1 }, dummyT, '45,00 €', '10/05/2026')).toEqual({
      title: 'Palestra in scadenza',
      body: 'Domani (10/05/2026) addebito di 45,00 €',
    })

    expect(formatReminderMessage({ ...baseReminder, daysBefore: 3 }, dummyT, '45,00 €', '10/05/2026')).toEqual({
      title: 'Palestra in scadenza',
      body: 'Tra 3 giorni (10/05/2026) addebito di 45,00 €',
    })
  })

  it('formatta la sintesi delle regole per il badge', () => {
    expect(formatRuleShort({ daysBefore: 0, time: '09:00' }, dummyT)).toBe('giorno stesso (09:00)')
    expect(formatRuleShort({ daysBefore: 1, time: '09:00' }, dummyT)).toBe('1g prima (09:00)')
    expect(formatRuleShort({ daysBefore: 7, time: '09:00' }, dummyT)).toBe('1 sett. prima (09:00)')
    expect(formatRuleShort({ daysBefore: 14, time: '09:00' }, dummyT)).toBe('2 sett. prima (09:00)')
    expect(formatRuleShort({ daysBefore: 5, time: '10:00' }, dummyT)).toBe('5g prima (10:00)')

    expect(formatRulesSummary(undefined, dummyT)).toBe('')
    expect(formatRulesSummary([], dummyT)).toBe('')
    expect(
      formatRulesSummary(
        [
          { daysBefore: 7, time: '09:00' },
          { daysBefore: 1, time: '09:00' },
          { daysBefore: 0, time: '18:00' },
        ],
        dummyT,
      ),
    ).toBe('1 sett. prima (09:00), 1g prima (09:00), giorno stesso (18:00)')
  })
})

