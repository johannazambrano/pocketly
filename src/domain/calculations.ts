import type { Cents, FinanceData, Id, Loan } from '@/types/models'
import { parseIsoDate, yearOf } from '@/utils/dates'
import { amountInMonth, isActiveInYear, monthlyEquivalent, nextDueDate } from './recurrence'

export interface TagTotal {
  id: Id
  total: Cents
}

export interface YearSummary {
  /** Primo mese del periodo attivo (0–11); il periodo arriva sempre a dicembre. */
  periodStartMonth: number
  totalIncome: Cents
  oneTimeTotal: Cents
  /** Addebiti ricorrenti che cadono nel periodo attivo. */
  recurringInPeriod: Cents
  totalExpenses: Cents
  balance: Cents
  /** Somma dei costi mensili equivalenti delle ricorrenze attive nell'anno. */
  monthlyRecurring: number
  byCategory: TagTotal[]
  byPaymentMethod: TagTotal[]
}

export interface ForecastRow {
  month: number
  income: Cents
  /** True se non ci sono entrate registrate nel mese e il valore è una media. */
  incomeEstimated: boolean
  expenses: Cents
  balance: Cents
  cumulative: Cents
}

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0)

function inYear<T extends { date: string }>(items: T[], year: number): T[] {
  return items.filter((i) => yearOf(i.date) === year)
}

/**
 * Il periodo attivo parte dal mese del primo movimento registrato nell'anno
 * (o da gennaio se non ce ne sono) e arriva a dicembre.
 */
export function periodStartMonth(data: FinanceData, year: number): number {
  const months = [...inYear(data.oneTimeExpenses, year), ...inYear(data.incomes, year)].map(
    (i) => parseIsoDate(i.date).month,
  )
  return months.length ? Math.min(...months) : 0
}

function addTo(map: Map<Id, Cents>, id: Id, amount: Cents) {
  map.set(id, (map.get(id) ?? 0) + amount)
}

function sortedTotals(map: Map<Id, Cents>): TagTotal[] {
  return [...map.entries()]
    .filter(([, total]) => total > 0)
    .map(([id, total]) => ({ id, total }))
    .sort((a, b) => b.total - a.total)
}

export function yearSummary(data: FinanceData, year: number): YearSummary {
  const start = periodStartMonth(data, year)
  const oneTime = inYear(data.oneTimeExpenses, year)
  const byCategory = new Map<Id, Cents>()
  const byPayment = new Map<Id, Cents>()

  for (const e of oneTime) {
    addTo(byCategory, e.categoryId, e.amount)
    addTo(byPayment, e.paymentMethodId, e.amount)
  }

  let recurringInPeriod = 0
  for (const r of data.recurringExpenses) {
    for (let m = start; m < 12; m++) {
      const amount = amountInMonth(r, year, m)
      if (!amount) continue
      recurringInPeriod += amount
      addTo(byCategory, r.categoryId, amount)
      addTo(byPayment, r.paymentMethodId, amount)
    }
  }

  const totalIncome = sum(inYear(data.incomes, year).map((i) => i.amount))
  const oneTimeTotal = sum(oneTime.map((e) => e.amount))
  const totalExpenses = oneTimeTotal + recurringInPeriod

  return {
    periodStartMonth: start,
    totalIncome,
    oneTimeTotal,
    recurringInPeriod,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    monthlyRecurring: sum(data.recurringExpenses.filter((r) => isActiveInYear(r, year)).map(monthlyEquivalent)),
    byCategory: sortedTotals(byCategory),
    byPaymentMethod: sortedTotals(byPayment),
  }
}

/**
 * Proiezione mese per mese, dal mese di inizio del periodo attivo a dicembre.
 * Per i mesi senza entrate registrate si usa la media dei mesi che ne hanno.
 */
export function forecast(data: FinanceData, year: number): ForecastRow[] {
  const start = periodStartMonth(data, year)
  const incomes = inYear(data.incomes, year)
  const oneTime = inYear(data.oneTimeExpenses, year)
  const simulations = data.simulations.filter((s) => s.year === year)

  const incomeByMonth = new Map<number, Cents>()
  for (const i of incomes) {
    const m = parseIsoDate(i.date).month
    incomeByMonth.set(m, (incomeByMonth.get(m) ?? 0) + i.amount)
  }
  const average = incomeByMonth.size ? Math.round(sum([...incomeByMonth.values()]) / incomeByMonth.size) : 0

  const rows: ForecastRow[] = []
  let cumulative = 0
  for (let m = start; m < 12; m++) {
    const actual = incomeByMonth.get(m)
    const income = actual ?? average
    const expenses =
      sum(oneTime.filter((e) => parseIsoDate(e.date).month === m).map((e) => e.amount)) +
      sum(data.recurringExpenses.map((r) => amountInMonth(r, year, m))) +
      sum(simulations.filter((s) => s.month === m).map((s) => s.amount))
    const balance = income - expenses
    cumulative += balance
    rows.push({ month: m, income, incomeEstimated: actual === undefined, expenses, balance, cumulative })
  }
  return rows
}

export interface UpcomingCharge {
  id: Id
  name: string
  amount: Cents
  date: string
  daysLeft: number
}

/** Addebiti ricorrenti previsti nei prossimi `days` giorni, dal più vicino. */
export function upcomingCharges(data: FinanceData, today: string, days: number): UpcomingCharge[] {
  const t = parseIsoDate(today)
  const todayMs = Date.UTC(t.year, t.month, t.day)
  const result: UpcomingCharge[] = []
  for (const r of data.recurringExpenses) {
    const due = nextDueDate(r, today)
    if (!due) continue
    const d = parseIsoDate(due)
    const daysLeft = Math.round((Date.UTC(d.year, d.month, d.day) - todayMs) / 86_400_000)
    if (daysLeft <= days) result.push({ id: r.id, name: r.name, amount: r.amount, date: due, daysLeft })
  }
  return result.sort((a, b) => a.daysLeft - b.daysLeft)
}

export function loanStatus(loan: Loan): { repaid: Cents; remaining: Cents } {
  const repaid = sum(loan.repayments.map((r) => r.amount))
  return { repaid, remaining: loan.amount - repaid }
}

/** Anni per cui esistono dati, più l'anno corrente. */
export function availableYears(data: FinanceData, currentYear: number): number[] {
  const years = new Set<number>([currentYear])
  for (const i of [...data.oneTimeExpenses, ...data.incomes, ...data.loans]) years.add(yearOf(i.date))
  for (const s of data.simulations) years.add(s.year)
  for (const r of data.recurringExpenses) years.add(yearOf(r.startDate))
  return [...years].sort((a, b) => a - b)
}
