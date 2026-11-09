import type { Cents, FinanceData, Id, Loan, OneTimeExpense } from '@/types/models'
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
  /** Le due parti di `expensesToDate`: spese una tantum e addebiti ricorrenti già avvenuti. */
  oneTimeToDate: Cents
  recurringToDate: Cents
  balanceToDate: Cents
  /** Entrate dell'anno più, se attivata, la stima dei mesi da oggi in poi. */
  projectedIncome: Cents
  /** Saldo a fine anno: entrate previste meno tutte le uscite programmate (simulazioni escluse). */
  projectedBalance: Cents
  /** Somma dei costi mensili equivalenti delle ricorrenze attive nell'anno. */
  monthlyRecurring: number
  /** Uscite di tutto l'anno, comprese quelle programmate fino a dicembre. */
  byCategory: TagTotal[]
  byPaymentMethod: TagTotal[]
  /** Solo le uscite già avvenute: tornano con `expensesToDate`. */
  byCategoryToDate: TagTotal[]
  byPaymentMethodToDate: TagTotal[]
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
 * Categorie di entrata da stimare: quelle scelte dall'utente oppure, se non ne ha scelte, quelle che si
 * ripetono, cioè presenti in almeno 2 dei 3 mesi prima di quello di oggi (es. lo stipendio).
 * Un rimborso o un regalo occasionale non si ripete e resta fuori.
 */
export function estimateCategoryIds(data: FinanceData, today: string): Id[] {
  if (data.forecast.incomeCategoryIds.length) return data.forecast.incomeCategoryIds
  const t = parseIsoDate(today)
  const now = monthIndex(t.year, t.month)
  const monthsByCategory = new Map<Id, Set<number>>()
  for (const i of data.incomes) {
    const { year, month } = parseIsoDate(i.date)
    const key = monthIndex(year, month)
    if (key < now - 3 || key >= now) continue
    if (!monthsByCategory.has(i.categoryId)) monthsByCategory.set(i.categoryId, new Set())
    monthsByCategory.get(i.categoryId)!.add(key)
  }
  return [...monthsByCategory.entries()].filter(([, months]) => months.size >= 2).map(([id]) => id)
}

/**
 * Stima dell'entrata mensile: media degli ultimi mesi (fino a `ESTIMATE_MONTHS`) in cui ci sono state
 * entrate nelle categorie scelte dall'utente. Conta solo ciò che è già successo (data fino a oggi).
 * Restituisce 0 se la stima è disattivata, se non ci sono categorie o se non c'è ancora nulla su cui basarla.
 */
export function estimateMonthlyIncome(data: FinanceData, today: string): Cents {
  if (!data.forecast.estimateIncome) return 0
  const chosen = new Set(estimateCategoryIds(data, today))
  if (!chosen.size) return 0
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
  const chosen = new Set(estimateCategoryIds(data, today))
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
  const byCategoryToDate = new Map<Id, Cents>()
  const byPaymentToDate = new Map<Id, Cents>()

  for (const e of oneTime) {
    addTo(byCategory, e.categoryId, e.amount)
    addTo(byPayment, e.paymentMethodId, e.amount)
    if (e.date <= cutoff) {
      addTo(byCategoryToDate, e.categoryId, e.amount)
      addTo(byPaymentToDate, e.paymentMethodId, e.amount)
    }
  }

  let recurringInPeriod = 0
  let recurringToDate = 0
  for (const r of data.recurringExpenses) {
    for (let m = start; m < 12; m++) {
      const due = dueDateIn(r, year, m)
      if (!due) continue
      recurringInPeriod += r.amount
      addTo(byCategory, r.categoryId, r.amount)
      addTo(byPayment, r.paymentMethodId, r.amount)
      if (due <= cutoff) {
        recurringToDate += r.amount
        addTo(byCategoryToDate, r.categoryId, r.amount)
        addTo(byPaymentToDate, r.paymentMethodId, r.amount)
      }
    }
  }

  const incomes = inYear(data.incomes, year)
  const totalIncome = sum(incomes.map((i) => i.amount))
  const oneTimeTotal = sum(oneTime.map((e) => e.amount))
  const totalExpenses = oneTimeTotal + recurringInPeriod

  const incomeToDate = sum(incomes.filter((i) => i.date <= cutoff).map((i) => i.amount))
  const oneTimeToDate = sum(oneTime.filter((e) => e.date <= cutoff).map((e) => e.amount))
  const expensesToDate = oneTimeToDate + recurringToDate
  const projectedIncome = sum([...incomeByMonth(data, year, today).values()].map((v) => v.income))

  return {
    periodStartMonth: start,
    totalIncome,
    oneTimeTotal,
    recurringInPeriod,
    totalExpenses,
    incomeToDate,
    expensesToDate,
    oneTimeToDate,
    recurringToDate,
    balanceToDate: incomeToDate - expensesToDate,
    projectedIncome,
    projectedBalance: projectedIncome - totalExpenses,
    monthlyRecurring: sum(data.recurringExpenses.filter((r) => isActiveInYear(r, year)).map(monthlyEquivalent)),
    byCategory: sortedTotals(byCategory),
    byPaymentMethod: sortedTotals(byPayment),
    byCategoryToDate: sortedTotals(byCategoryToDate),
    byPaymentMethodToDate: sortedTotals(byPaymentToDate),
  }
}

export interface MonthBreakdown {
  byCategory: TagTotal[]
  byPaymentMethod: TagTotal[]
  totalExpenses: Cents
}

/**
 * Ripartizione delle uscite di un singolo mese (0–11) in un dato anno:
 * spese una tantum con data nel mese + addebiti ricorrenti con scadenza nel mese.
 * Con `cutoff` conta solo ciò che ha data fino a quel giorno compreso.
 */
export function monthBreakdown(data: FinanceData, year: number, month: number, cutoff?: string): MonthBreakdown {
  const byCategory = new Map<Id, Cents>()
  const byPayment = new Map<Id, Cents>()

  for (const e of data.oneTimeExpenses) {
    const d = parseIsoDate(e.date)
    if (d.year === year && d.month === month && (!cutoff || e.date <= cutoff)) {
      addTo(byCategory, e.categoryId, e.amount)
      addTo(byPayment, e.paymentMethodId, e.amount)
    }
  }

  for (const r of data.recurringExpenses) {
    const due = dueDateIn(r, year, month)
    if (due && (!cutoff || due <= cutoff)) {
      addTo(byCategory, r.categoryId, r.amount)
      addTo(byPayment, r.paymentMethodId, r.amount)
    }
  }

  const totals = sortedTotals(byCategory)
  const totalExpenses = sum(totals.map((t) => t.total))

  return {
    byCategory: totals,
    byPaymentMethod: sortedTotals(byPayment),
    totalExpenses,
  }
}

/** Dove sta un mese rispetto a oggi: passato (tutto avvenuto), corrente o futuro (tutto da avvenire). */
export type MonthTiming = 'past' | 'current' | 'future'

export interface MonthSummary {
  timing: MonthTiming
  /** Tutto il mese, comprese le uscite con data futura e gli addebiti non ancora arrivati. */
  income: Cents
  expenses: Cents
  balance: Cents
  oneTimeTotal: Cents
  recurringInMonth: Cents
  byCategory: TagTotal[]
  byPaymentMethod: TagTotal[]
  /** Solo ciò che è già avvenuto: per un mese passato coincide con il totale, per uno futuro è zero. */
  incomeToDate: Cents
  expensesToDate: Cents
  /** Le due parti di `expensesToDate`: spese una tantum e addebiti ricorrenti già avvenuti. */
  oneTimeToDate: Cents
  recurringToDate: Cents
  balanceToDate: Cents
  byCategoryToDate: TagTotal[]
  byPaymentMethodToDate: TagTotal[]
  /** Entrate del mese più, se attivata, la stima (solo per il mese corrente e quelli futuri). */
  projectedIncome: Cents
  /** Saldo a fine mese: entrate previste meno tutte le uscite del mese (simulazioni escluse, come per l'anno). */
  projectedBalance: Cents
}

/**
 * Riepilogo completo di un singolo mese (0–11) in un dato anno:
 * entrate del mese, uscite (una tantum + ricorrenti), saldo netto e ripartizioni,
 * sia per tutto il mese sia solo per ciò che è già avvenuto rispetto a oggi.
 */
export function monthSummary(data: FinanceData, year: number, month: number, today: string = todayIso()): MonthSummary {
  const t = parseIsoDate(today)
  const key = monthIndex(year, month)
  const now = monthIndex(t.year, t.month)
  const timing: MonthTiming = key < now ? 'past' : key > now ? 'future' : 'current'
  // Ultimo giorno già avvenuto nel mese: per un mese futuro nessuno.
  const cutoff = timing === 'past' ? '9999-12-31' : timing === 'current' ? today : '0000-01-01'

  const breakdown = monthBreakdown(data, year, month)
  const breakdownToDate = monthBreakdown(data, year, month, cutoff)

  const inMonth = <T extends { date: string }>(items: T[]) =>
    items.filter((i) => {
      const d = parseIsoDate(i.date)
      return d.year === year && d.month === month
    })
  const incomes = inMonth(data.incomes)
  const income = sum(incomes.map((i) => i.amount))
  const incomeToDate = sum(incomes.filter((i) => i.date <= cutoff).map((i) => i.amount))
  const oneTime = inMonth(data.oneTimeExpenses)
  const oneTimeTotal = sum(oneTime.map((e) => e.amount))
  const oneTimeToDate = sum(oneTime.filter((e) => e.date <= cutoff).map((e) => e.amount))

  const expenses = breakdown.totalExpenses
  const expensesToDate = breakdownToDate.totalExpenses
  const projectedIncome = incomeByMonth(data, year, today).get(month)?.income ?? income

  return {
    timing,
    income,
    expenses,
    balance: income - expenses,
    oneTimeTotal,
    recurringInMonth: expenses - oneTimeTotal,
    byCategory: breakdown.byCategory,
    byPaymentMethod: breakdown.byPaymentMethod,
    incomeToDate,
    expensesToDate,
    oneTimeToDate,
    recurringToDate: expensesToDate - oneTimeToDate,
    balanceToDate: incomeToDate - expensesToDate,
    byCategoryToDate: breakdownToDate.byCategory,
    byPaymentMethodToDate: breakdownToDate.byPaymentMethod,
    projectedIncome,
    projectedBalance: projectedIncome - expenses,
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
  /** Solo quelle con data fino a oggi: il mese non è ancora finito. */
  toDate: Cents
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
    toDate: sum(oneTime.filter((e) => e.date <= today && parseIsoDate(e.date).month === t.month).map((e) => e.amount)),
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

export interface TagSummaryItem {
  id: Id
  total: Cents
  count: number
}

/**
 * Calcola il totale e il conteggio delle spese una tantum raggruppate per ciascun tag presente.
 * Restituisce i tag ordinati per importo decrescente.
 */
export function oneTimeTagBreakdown(expenses: OneTimeExpense[]): TagSummaryItem[] {
  const totals = new Map<Id, Cents>()
  const counts = new Map<Id, number>()

  for (const e of expenses) {
    if (!e.tagIds || e.tagIds.length === 0) continue
    for (const tagId of e.tagIds) {
      totals.set(tagId, (totals.get(tagId) ?? 0) + e.amount)
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
    }
  }

  return [...totals.entries()]
    .map(([id, total]) => ({ id, total, count: counts.get(id) ?? 0 }))
    .sort((a, b) => b.total - a.total)
}

