import type { Cents, FinanceData, Id, Loan } from '@/types/models'
import { monthIndex, parseIsoDate, todayIso, yearOf } from '@/utils/dates'
import { amountInMonth, dueDateIn, isActiveInYear, monthlyEquivalent, nextDueDate } from './recurrence'

export interface TagTotal {
  id: Id
  total: Cents
}

export interface YearSummary {
  /** Primo mese del periodo attivo (0–11); il periodo arriva sempre a dicembre. */
  periodStartMonth: number
  /** Entrate registrate nell'anno (comprese quelle con data futura). */
  totalIncome: Cents
  oneTimeTotal: Cents
  /** Addebiti ricorrenti che cadono nel periodo attivo. */
  recurringInPeriod: Cents
  /** Uscite dell'anno: una tantum registrate e ricorrenze programmate fino a dicembre. */
  totalExpenses: Cents
  /** Quanto è già successo: solo movimenti con data fino a oggi (per un anno passato, tutto l'anno). */
  incomeToDate: Cents
  expensesToDate: Cents
  balanceToDate: Cents
  /** Entrate dell'anno più, se attivata, la stima dei mesi da oggi in poi. */
  projectedIncome: Cents
  /** Saldo a fine anno: entrate previste meno tutte le uscite programmate (simulazioni escluse). */
  projectedBalance: Cents
  /** Somma dei costi mensili equivalenti delle ricorrenze attive nell'anno. */
  monthlyRecurring: number
  byCategory: TagTotal[]
  byPaymentMethod: TagTotal[]
}

export interface ForecastRow {
  month: number
  income: Cents
  /** True se al valore è stata aggiunta la stima delle entrate (funzione facoltativa). */
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

/** Quanti mesi con entrate nelle categorie scelte servono a calcolare la stima. */
export const ESTIMATE_MONTHS = 3

/**
 * Stima dell'entrata mensile: media degli ultimi mesi (fino a `ESTIMATE_MONTHS`) in cui ci sono state
 * entrate nelle categorie scelte dall'utente. Conta solo ciò che è già successo (data fino a oggi).
 * Restituisce 0 se la stima è disattivata, se non ci sono categorie o se non c'è ancora nulla su cui basarla.
 */
export function estimateMonthlyIncome(data: FinanceData, today: string): Cents {
  const { estimateIncome, incomeCategoryIds } = data.forecast
  if (!estimateIncome || !incomeCategoryIds.length) return 0
  const chosen = new Set(incomeCategoryIds)
  const perMonth = new Map<number, Cents>()
  for (const i of data.incomes) {
    if (!chosen.has(i.categoryId) || i.date > today) continue
    const { year, month } = parseIsoDate(i.date)
    const key = monthIndex(year, month)
    perMonth.set(key, (perMonth.get(key) ?? 0) + i.amount)
  }
  const latest = [...perMonth.entries()].sort((a, b) => b[0] - a[0]).slice(0, ESTIMATE_MONTHS)
  return latest.length ? Math.round(sum(latest.map(([, total]) => total)) / latest.length) : 0
}

interface IncomeOfMonth {
  income: Cents
  estimated: boolean
}

/**
 * Entrate mese per mese, dal mese di inizio del periodo attivo a dicembre.
 * Le entrate non sono ricorrenti: ogni mese vale ciò che è stato registrato, e un mese senza entrate vale 0.
 * L'unica eccezione è la stima facoltativa, che si aggiunge solo al mese corrente e a quelli futuri
 * quando in quel mese non c'è ancora un'entrata delle categorie scelte. I mesi passati non si stimano mai.
 */
function incomeByMonth(data: FinanceData, year: number, today: string): Map<number, IncomeOfMonth> {
  const t = parseIsoDate(today)
  const currentMonth = monthIndex(t.year, t.month)
  const estimate = estimateMonthlyIncome(data, today)
  const chosen = new Set(data.forecast.incomeCategoryIds)
  const incomes = inYear(data.incomes, year)

  const result = new Map<number, IncomeOfMonth>()
  for (let m = periodStartMonth(data, year); m < 12; m++) {
    const inMonth = incomes.filter((i) => parseIsoDate(i.date).month === m)
    const registered = sum(inMonth.map((i) => i.amount))
    const hasChosen = inMonth.some((i) => chosen.has(i.categoryId))
    const stimable = monthIndex(year, m) >= currentMonth && !hasChosen && estimate > 0
    result.set(m, { income: registered + (stimable ? estimate : 0), estimated: stimable })
  }
  return result
}

/** Ultimo giorno già "avvenuto" nell'anno indicato, rispetto a oggi. */
function cutoffDate(year: number, today: string): string {
  const current = yearOf(today)
  if (year < current) return `${year}-12-31`
  if (year > current) return `${year - 1}-12-31`
  return today
}

export function yearSummary(data: FinanceData, year: number, today: string = todayIso()): YearSummary {
  const start = periodStartMonth(data, year)
  const cutoff = cutoffDate(year, today)
  const oneTime = inYear(data.oneTimeExpenses, year)
  const byCategory = new Map<Id, Cents>()
  const byPayment = new Map<Id, Cents>()

  for (const e of oneTime) {
    addTo(byCategory, e.categoryId, e.amount)
    addTo(byPayment, e.paymentMethodId, e.amount)
  }

  let recurringInPeriod = 0
  let recurringToDate = 0
  for (const r of data.recurringExpenses) {
    for (let m = start; m < 12; m++) {
      const due = dueDateIn(r, year, m)
      if (!due) continue
      recurringInPeriod += r.amount
      if (due <= cutoff) recurringToDate += r.amount
      addTo(byCategory, r.categoryId, r.amount)
      addTo(byPayment, r.paymentMethodId, r.amount)
    }
  }

  const incomes = inYear(data.incomes, year)
  const totalIncome = sum(incomes.map((i) => i.amount))
  const oneTimeTotal = sum(oneTime.map((e) => e.amount))
  const totalExpenses = oneTimeTotal + recurringInPeriod

  const incomeToDate = sum(incomes.filter((i) => i.date <= cutoff).map((i) => i.amount))
  const expensesToDate = sum(oneTime.filter((e) => e.date <= cutoff).map((e) => e.amount)) + recurringToDate
  const projectedIncome = sum([...incomeByMonth(data, year, today).values()].map((v) => v.income))

  return {
    periodStartMonth: start,
    totalIncome,
    oneTimeTotal,
    recurringInPeriod,
    totalExpenses,
    incomeToDate,
    expensesToDate,
    balanceToDate: incomeToDate - expensesToDate,
    projectedIncome,
    projectedBalance: projectedIncome - totalExpenses,
    monthlyRecurring: sum(data.recurringExpenses.filter((r) => isActiveInYear(r, year)).map(monthlyEquivalent)),
    byCategory: sortedTotals(byCategory),
    byPaymentMethod: sortedTotals(byPayment),
  }
}

/**
 * Proiezione mese per mese, dal mese di inizio del periodo attivo a dicembre.
 * Entrate: solo quelle registrate (vedi `incomeByMonth`), più la stima se l'utente l'ha attivata.
 */
export function forecast(data: FinanceData, year: number, today: string = todayIso()): ForecastRow[] {
  const incomes = incomeByMonth(data, year, today)
  const oneTime = inYear(data.oneTimeExpenses, year)
  const simulations = data.simulations.filter((s) => s.year === year)

  const rows: ForecastRow[] = []
  let cumulative = 0
  for (const [m, { income, estimated }] of incomes) {
    const expenses =
      sum(oneTime.filter((e) => parseIsoDate(e.date).month === m).map((e) => e.amount)) +
      sum(data.recurringExpenses.map((r) => amountInMonth(r, year, m))) +
      sum(simulations.filter((s) => s.month === m).map((s) => s.amount))
    const balance = income - expenses
    cumulative += balance
    rows.push({ month: m, income, incomeEstimated: estimated, expenses, balance, cumulative })
  }
  return rows
}

export interface VariableSpending {
  /** Mese di oggi (0–11). */
  month: number
  /** Spese una tantum del mese di oggi. */
  total: Cents
  /** Media mensile delle spese una tantum dei mesi precedenti dell'anno, o null se non ce ne sono. */
  previousAverage: Cents | null
}

/**
 * Spese variabili (una tantum) del mese di oggi, da confrontare con la media dei mesi precedenti dell'anno.
 * I mesi contano dal primo movimento registrato: quelli prima dell'inizio dell'uso dell'app non fanno media.
 */
export function variableSpending(data: FinanceData, today: string): VariableSpending {
  const t = parseIsoDate(today)
  const oneTime = inYear(data.oneTimeExpenses, t.year)
  const ofMonth = (m: number) => sum(oneTime.filter((e) => parseIsoDate(e.date).month === m).map((e) => e.amount))
  const previous: Cents[] = []
  // Senza alcun movimento nell'anno non c'è un "primo mese" da cui far partire la media.
  const hasMovements = oneTime.length > 0 || inYear(data.incomes, t.year).length > 0
  if (hasMovements) for (let m = periodStartMonth(data, t.year); m < t.month; m++) previous.push(ofMonth(m))
  return {
    month: t.month,
    total: ofMonth(t.month),
    previousAverage: previous.length ? Math.round(sum(previous) / previous.length) : null,
  }
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
