import type { Cents, Id, IsoDate, NotificationRule, RecurringExpense } from '@/types/models'
import { nextDueDate } from '@/domain/recurrence'
import { parseIsoDate, toIsoDate } from '@/utils/dates'

/** Scelte rapide di anticipo proposte nel selettore (in giorni prima della scadenza). */
export const PRESET_DAYS_BEFORE = [0, 1, 2, 3, 5, 7, 14] as const

export const MAX_DAYS_BEFORE = 365
export const MAX_NOTIFICATION_RULES = 5

export const DEFAULT_NOTIFICATION_RULE: NotificationRule = {
  daysBefore: 1,
  time: '09:00',
}

const CANDIDATE_RULES: NotificationRule[] = [
  { daysBefore: 1, time: '09:00' },
  { daysBefore: 0, time: '09:00' },
  { daysBefore: 3, time: '09:00' },
  { daysBefore: 7, time: '09:00' },
  { daysBefore: 2, time: '09:00' },
  { daysBefore: 5, time: '09:00' },
  { daysBefore: 14, time: '09:00' },
  { daysBefore: 1, time: '18:00' },
  { daysBefore: 0, time: '18:00' },
]

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function isValidDaysBefore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_DAYS_BEFORE
}

export function ruleKey(rule: NotificationRule): string {
  return `${rule.daysBefore}:${rule.time}`
}

/**
 * Restituisce un elenco canonico di regole di notifica:
 * scarta quelle malformate, elimina i duplicati, ordina dal preavviso più lontano
 * al più vicino (e a parità di giorno per orario crescente) e limita a `MAX_NOTIFICATION_RULES`.
 */
export function normalizeNotifications(raw: unknown): NotificationRule[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const valid: NotificationRule[] = []

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const candidate = item as Record<string, unknown>
    const daysBefore = candidate.daysBefore
    const time = candidate.time
    if (!isValidDaysBefore(daysBefore) || !isValidTime(time)) continue
    const rule: NotificationRule = { daysBefore, time }
    const key = ruleKey(rule)
    if (seen.has(key)) continue
    seen.add(key)
    valid.push(rule)
  }

  valid.sort((a, b) => b.daysBefore - a.daysBefore || a.time.localeCompare(b.time))
  return valid.slice(0, MAX_NOTIFICATION_RULES)
}

/** Sceglie una nuova regola non ancora presente nell'elenco quando l'utente preme "+ Aggiungi notifica". */
export function nextCandidateRule(existing: NotificationRule[]): NotificationRule {
  const taken = new Set(existing.map(ruleKey))
  for (const candidate of CANDIDATE_RULES) {
    if (!taken.has(ruleKey(candidate))) return { ...candidate }
  }
  for (let d = 0; d <= MAX_DAYS_BEFORE; d++) {
    const fallback: NotificationRule = { daysBefore: d, time: '09:00' }
    if (!taken.has(ruleKey(fallback))) return fallback
  }
  return { ...DEFAULT_NOTIFICATION_RULE }
}

/** Sposta una data ISO di `deltaDays` giorni di calendario. */
export function shiftIsoDate(date: IsoDate, deltaDays: number): IsoDate {
  const { year, month, day } = parseIsoDate(date)
  const shifted = new Date(year, month, day + deltaDays)
  return toIsoDate(shifted.getFullYear(), shifted.getMonth(), shifted.getDate())
}

/** Data ISO nel fuso orario locale di `now`. */
export function localIsoDate(now: Date): IsoDate {
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Calcola l'istante locale in cui deve scattare il promemoria per l'addebito `dueDate`. */
export function reminderTriggerDate(dueDate: IsoDate, rule: NotificationRule): Date {
  const { year, month, day } = parseIsoDate(dueDate)
  const [hStr, mStr] = rule.time.split(':')
  const hours = Number(hStr) || 0
  const minutes = Number(mStr) || 0
  return new Date(year, month, day - rule.daysBefore, hours, minutes, 0, 0)
}

/** Tutte le date di addebito di `r` comprese nell'intervallo `[fromIso, toIso]` (estremi inclusi). */
export function occurrencesBetween(r: RecurringExpense, fromIso: IsoDate, toIso: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  let cursor = fromIso
  while (cursor <= toIso) {
    const due = nextDueDate(r, cursor)
    if (!due || due > toIso) break
    out.push(due)
    cursor = shiftIsoDate(due, 1)
  }
  return out
}

export interface ScheduledReminder {
  /** ID deterministico: `${expenseId}:${dueDate}:${daysBefore}:${time}` */
  id: string
  expenseId: Id
  expenseName: string
  amount: Cents
  dueDate: IsoDate
  daysBefore: number
  time: string
  /** Timestamp UTC in secondi dell'invio previsto. */
  fireAt: number
}

export function reminderId(expenseId: Id, dueDate: IsoDate, rule: NotificationRule): string {
  return `${expenseId}:${dueDate}:${rule.daysBefore}:${rule.time}`
}

/**
 * Calcola tutti i promemoria futuri da inviare tra `now` (escluso) e `now + horizonDays`.
 * Restituisce l'elenco ordinato per `fireAt` crescente.
 */
export function calculateUpcomingReminders(
  expenses: RecurringExpense[],
  now: Date,
  horizonDays = 60,
): ScheduledReminder[] {
  const nowSec = Math.floor(now.getTime() / 1000)
  const maxSec = nowSec + horizonDays * 86_400
  const today = localIsoDate(now)
  const out: ScheduledReminder[] = []

  for (const r of expenses) {
    const rules = normalizeNotifications(r.notifications)
    if (!rules.length) continue
    const maxLead = Math.max(...rules.map((rule) => rule.daysBefore))
    const lastDueToInspect = shiftIsoDate(today, horizonDays + maxLead + 1)
    const dueDates = occurrencesBetween(r, today, lastDueToInspect)

    for (const dueDate of dueDates) {
      for (const rule of rules) {
        const trigger = reminderTriggerDate(dueDate, rule)
        const fireAt = Math.floor(trigger.getTime() / 1000)
        if (fireAt > nowSec && fireAt <= maxSec) {
          out.push({
            id: reminderId(r.id, dueDate, rule),
            expenseId: r.id,
            expenseName: r.name,
            amount: r.amount,
            dueDate,
            daysBefore: rule.daysBefore,
            time: rule.time,
            fireAt,
          })
        }
      }
    }
  }

  return out.sort((a, b) => a.fireAt - b.fireAt || a.id.localeCompare(b.id))
}

/**
 * Promemoria il cui orario di invio è già maturato (nelle ultime `lookbackHours` ore)
 * per addebiti non ancora passati (`dueDate >= today`), usato dal motore locale all'apertura dell'app.
 */
export function calculateDueLocalReminders(
  expenses: RecurringExpense[],
  now: Date,
  lookbackHours = 24,
): ScheduledReminder[] {
  const nowSec = Math.floor(now.getTime() / 1000)
  const minSec = nowSec - lookbackHours * 3600
  const today = localIsoDate(now)
  const out: ScheduledReminder[] = []

  for (const r of expenses) {
    const rules = normalizeNotifications(r.notifications)
    if (!rules.length) continue
    const maxLead = Math.max(...rules.map((rule) => rule.daysBefore))
    const lastDueToInspect = shiftIsoDate(today, maxLead + 2)
    const dueDates = occurrencesBetween(r, today, lastDueToInspect)

    for (const dueDate of dueDates) {
      for (const rule of rules) {
        const trigger = reminderTriggerDate(dueDate, rule)
        const fireAt = Math.floor(trigger.getTime() / 1000)
        if (fireAt >= minSec && fireAt <= nowSec) {
          out.push({
            id: reminderId(r.id, dueDate, rule),
            expenseId: r.id,
            expenseName: r.name,
            amount: r.amount,
            dueDate,
            daysBefore: rule.daysBefore,
            time: rule.time,
            fireAt,
          })
        }
      }
    }
  }

  return out.sort((a, b) => a.fireAt - b.fireAt || a.id.localeCompare(b.id))
}

/** Formatta il testo del titolo e del corpo della notifica per un promemoria. */
export function formatReminderMessage(
  reminder: ScheduledReminder,
  t: (key: string, values?: Record<string, unknown>) => string,
  formattedAmount: string,
  formattedDueDate: string,
): { title: string; body: string } {
  const title = t('notifications.pushMessage.title', { name: reminder.expenseName })
  let body = ''
  if (reminder.daysBefore === 0) {
    body = t('notifications.pushMessage.bodyToday', { amount: formattedAmount })
  } else if (reminder.daysBefore === 1) {
    body = t('notifications.pushMessage.bodyTomorrow', { amount: formattedAmount, date: formattedDueDate })
  } else {
    body = t('notifications.pushMessage.bodyInDays', {
      days: reminder.daysBefore,
      amount: formattedAmount,
      date: formattedDueDate,
    })
  }
  return { title, body }
}

/** Formatta una singola regola per la sintesi del badge (es. "1g prima (09:00)"). */
export function formatRuleShort(
  rule: NotificationRule,
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  if (rule.daysBefore === 0) {
    return t('notifications.shortBadge.d0', { time: rule.time })
  }
  if (rule.daysBefore === 1) {
    return t('notifications.shortBadge.d1', { time: rule.time })
  }
  if (rule.daysBefore === 7) {
    return t('notifications.shortBadge.d7', { time: rule.time })
  }
  if (rule.daysBefore === 14) {
    return t('notifications.shortBadge.d14', { time: rule.time })
  }
  return t('notifications.shortBadge.days', { n: rule.daysBefore, time: rule.time })
}

/** Sintesi compatta di tutte le regole attive per una spesa ricorrente. */
export function formatRulesSummary(
  rules: NotificationRule[] | undefined,
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  const list = normalizeNotifications(rules)
  if (!list.length) return ''
  return list.map((r) => formatRuleShort(r, t)).join(', ')
}

