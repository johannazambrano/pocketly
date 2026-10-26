import type { Cents, FinanceData, Id, IsoDate } from '@/types/models'
import { monthIndex, parseIsoDate } from '@/utils/dates'
import { ESTIMATE_MONTHS } from './calculations'
import { dueDateIn, monthlyEquivalent } from './recurrence'

/** Oltre questa quota del limite una categoria passa in "attenzione". */
export const BUDGET_WARNING_RATIO = 0.8
/** Prima di questo giorno del mese il ritmo di spesa è troppo poco significativo per fare una proiezione. */
export const MIN_PACE_DAYS = 5
/** I limiti proposti dalla media si arrotondano a multipli di questo importo (5 €). */
const SUGGESTION_STEP: Cents = 500

export type BudgetStatus = 'ok' | 'warning' | 'over'

export interface BudgetLine {
  categoryId: Id
  limit: Cents
  /** Spese e addebiti con data fino a oggi. */
  spent: Cents
  /** Spese e addebiti già inseriti ma con data futura nello stesso mese. */
  scheduled: Cents
  /** `limit - spent - scheduled`: negativo se il limite è superato. */
  remaining: Cents
  status: BudgetStatus
  /** Spesa prevista a fine mese al ritmo attuale; null se non calcolabile (vedi `MIN_PACE_DAYS`). */
  projected: Cents | null
}

export interface BudgetMonth {
  year: number
  month: number
  /** Solo le categorie con un limite, dalla più alla meno consumata. */
  lines: BudgetLine[]
  /** Spese del mese in categorie senza limite. */
  unbudgeted: Cents
  totalLimit: Cents
  totalSpent: Cents
  totalScheduled: Cents
  totalRemaining: Cents
  status: BudgetStatus
  /** Presenti solo se il mese è quello di oggi. */
  daysLeft: number | null
  /** Quanto si può spendere ogni giorno, da oggi a fine mese, restando nel budget; null se il budget è esaurito. */
  dailyAvailable: Cents | null
  projected: Cents | null
}

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0)

function statusOf(committed: Cents, limit: Cents): BudgetStatus {
  if (committed > limit) return 'over'
  return committed >= limit * BUDGET_WARNING_RATIO ? 'warning' : 'ok'
}

interface Expense {
  categoryId: Id
  amount: Cents
  date: IsoDate
  recurring: boolean
}

/** Tutte le uscite del mese: spese una tantum e addebiti ricorrenti nella loro data di scadenza. */
function expensesOfMonth(data: FinanceData, year: number, month: number): Expense[] {
  const result: Expense[] = []
  for (const e of data.oneTimeExpenses) {
    const d = parseIsoDate(e.date)
    if (d.year === year && d.month === month) {
      result.push({ categoryId: e.categoryId, amount: e.amount, date: e.date, recurring: false })
    }
  }
  for (const r of data.recurringExpenses) {
    const due = dueDateIn(r, year, month)
    if (due) result.push({ categoryId: r.categoryId, amount: r.amount, date: due, recurring: true })
  }
  return result
}

/**
 * Budget di un mese: per ogni categoria con un limite confronta quanto è già stato speso
 * (una tantum e ricorrenze, queste ultime alla loro scadenza) con il limite.
 * Ciò che ha data futura nel mese è già "in programma" e si toglie comunque dal budget disponibile.
 */
export function budgetMonth(data: FinanceData, year: number, month: number, today: IsoDate): BudgetMonth {
  const t = parseIsoDate(today)
  const isCurrent = t.year === year && t.month === month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const expenses = expensesOfMonth(data, year, month)
  const budgeted = new Set(Object.keys(data.budget.limits))

  const lines: BudgetLine[] = []
  for (const [categoryId, limit] of Object.entries(data.budget.limits)) {
    const mine = expenses.filter((e) => e.categoryId === categoryId)
    const spent = sum(mine.filter((e) => e.date <= today).map((e) => e.amount))
    const scheduled = sum(mine.filter((e) => e.date > today).map((e) => e.amount))
    const committed = spent + scheduled

    let projected: Cents | null = null
    if (isCurrent && t.day >= MIN_PACE_DAYS) {
      // Le spese variabili si estendono ai giorni che restano; ricorrenze e spese già datate nel futuro valgono quanto sono.
      const variableSoFar = sum(mine.filter((e) => !e.recurring && e.date <= today).map((e) => e.amount))
      projected = Math.round(committed + (variableSoFar / t.day) * (daysInMonth - t.day))
    }
    lines.push({ categoryId, limit, spent, scheduled, remaining: limit - committed, status: statusOf(committed, limit), projected })
  }
  lines.sort((a, b) => (b.spent + b.scheduled) / b.limit - (a.spent + a.scheduled) / a.limit)

  const totalLimit = sum(lines.map((l) => l.limit))
  const totalSpent = sum(lines.map((l) => l.spent))
  const totalScheduled = sum(lines.map((l) => l.scheduled))
  const totalRemaining = totalLimit - totalSpent - totalScheduled
  const daysLeft = isCurrent ? daysInMonth - t.day + 1 : null
  const projectable = lines.length > 0 && lines.every((l) => l.projected !== null)

  return {
    year,
    month,
    lines,
    unbudgeted: sum(expenses.filter((e) => !budgeted.has(e.categoryId)).map((e) => e.amount)),
    totalLimit,
    totalSpent,
    totalScheduled,
    totalRemaining,
    status: statusOf(totalSpent + totalScheduled, totalLimit),
    daysLeft,
    dailyAvailable: daysLeft !== null && totalRemaining > 0 ? Math.floor(totalRemaining / daysLeft) : null,
    projected: projectable ? sum(lines.map((l) => l.projected ?? 0)) : null,
  }
}

/**
 * Limiti suggeriti per le categorie in cui si è speso. Per ogni categoria:
 * - spese variabili: media mensile degli ultimi `ESTIMATE_MONTHS` mesi prima di quello indicato;
 * - ricorrenze attive nel mese: costo medio mensile (un'assicurazione annuale pesa 1/12 ogni mese).
 * I mesi precedenti al primo movimento registrato non contano, perché l'app non era ancora in uso.
 * Importi arrotondati a 5 €; le categorie che arrivano a zero non compaiono.
 */
export function suggestLimits(data: FinanceData, year: number, month: number): Record<Id, Cents> {
  const dates = [...data.oneTimeExpenses, ...data.incomes].map((x) => x.date)
  if (!dates.length) return {}
  const first = parseIsoDate(dates.reduce((a, b) => (a < b ? a : b)))
  const firstIndex = monthIndex(first.year, first.month)
  const target = monthIndex(year, month)

  const months: number[] = []
  for (let i = target - 1; i >= Math.max(firstIndex, target - ESTIMATE_MONTHS); i--) months.push(i)
  if (!months.length) return {}

  const raw = new Map<Id, number>()
  const add = (id: Id, amount: number) => raw.set(id, (raw.get(id) ?? 0) + amount)

  const inWindow = new Set(months)
  for (const e of data.oneTimeExpenses) {
    const d = parseIsoDate(e.date)
    if (inWindow.has(monthIndex(d.year, d.month))) add(e.categoryId, e.amount / months.length)
  }
  for (const r of data.recurringExpenses) {
    const start = parseIsoDate(r.startDate)
    const end = r.endDate ? parseIsoDate(r.endDate) : null
    const active =
      monthIndex(start.year, start.month) <= target && (!end || monthIndex(end.year, end.month) >= target)
    if (active) add(r.categoryId, monthlyEquivalent(r))
  }

  const result: Record<Id, Cents> = {}
  for (const [id, amount] of raw) {
    const rounded = Math.round(amount / SUGGESTION_STEP) * SUGGESTION_STEP
    if (rounded > 0) result[id] = rounded
  }
  return result
}
