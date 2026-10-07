import type {
  FinanceData,
  Frequency,
  Id,
  Income,
  IsoDate,
  Loan,
  OneTimeExpense,
  RecurringExpense,
  Repayment,
  Simulation,
  Tag,
} from '@/types/models'
import { FREQUENCIES } from '@/domain/recurrence'
import { pickUniqueColor } from '@/utils/colors'
import { isValidIsoDate, todayIso } from '@/utils/dates'
import { newId } from '@/utils/id'

export class BackupFormatError extends Error {}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback)
const date = (v: unknown, fallback: IsoDate): IsoDate => (isValidIsoDate(v) ? v : fallback)
const id = (v: unknown): Id => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : newId())
const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

/** Gli importi v1 sono euro decimali, quelli v2 centesimi interi. */
const eurosToCents = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
const cents = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)

/** Raccoglie categorie/metodi per nome e crea al volo quelli citati ma non più esistenti. */
class TagRegistry {
  readonly tags: Tag[] = []
  private byName = new Map<string, Tag>()

  constructor(source: unknown) {
    for (const entry of arr(source)) {
      const name = isObj(entry) ? str(entry.name).trim() : str(entry).trim()
      if (!name || this.byName.has(name.toLocaleLowerCase())) continue
      const color = isObj(entry) && isHexColor(entry.color) ? entry.color : undefined
      this.add(name, color)
    }
  }

  private add(name: string, color?: string): Tag {
    const tag: Tag = { id: newId(), name, color: color ?? pickUniqueColor(this.tags.map((t) => t.color)) }
    this.tags.push(tag)
    this.byName.set(name.toLocaleLowerCase(), tag)
    return tag
  }

  resolve(name: unknown, fallbackName: string): Id {
    const n = str(name).trim() || fallbackName
    // "PayPal" e "Paypal" sono lo stesso metodo: il prototipo non lo garantiva.
    return (this.byName.get(n.toLocaleLowerCase()) ?? this.add(n)).id
  }
}

const V1_FREQUENCIES: Record<string, Frequency> = {
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  'Semi-annual': 'semiannual',
  Annual: 'annual',
}

/** Converte i dati del prototipo HTML (backup JSON o localStorage) nello schema v2. */
export function migrateV1(raw: Obj): FinanceData {
  const categories = new TagRegistry(raw.categories)
  const payments = new TagRegistry(raw.paymentMethods)
  const data: FinanceData = {
    schemaVersion: 2,
    categories: categories.tags,
    paymentMethods: payments.tags,
    oneTimeExpenses: [],
    recurringExpenses: [],
    incomes: [],
    loans: [],
    simulations: [],
  }
  const seenRecurring = new Set<Id>()
  const years = isObj(raw.years) ? raw.years : {}

  for (const yearKey of Object.keys(years).sort()) {
    const yd = years[yearKey]
    if (!isObj(yd)) continue
    const year = Number(yearKey) || new Date().getFullYear()
    const firstOfYear = `${year}-01-01`

    for (const e of arr(yd.oneTimeExpenses).filter(isObj)) {
      data.oneTimeExpenses.push({
        id: id(e.id),
        name: str(e.name),
        amount: eurosToCents(e.amount),
        date: date(e.date, firstOfYear),
        categoryId: categories.resolve(e.category, 'Other'),
        paymentMethodId: payments.resolve(e.payment, 'Other'),
        notes: str(e.notes),
      })
    }

    for (const e of arr(yd.recurringExpenses).filter(isObj)) {
      const rid = id(e.id)
      if (seenRecurring.has(rid)) continue
      seenRecurring.add(rid)
      data.recurringExpenses.push({
        id: rid,
        name: str(e.name),
        amount: eurosToCents(e.amount),
        frequency: V1_FREQUENCIES[str(e.frequency)] ?? 'monthly',
        // Nel prototipo le ricorrenze valevano per tutto l'anno in cui erano inserite.
        startDate: firstOfYear,
        endDate: null,
        categoryId: categories.resolve(e.category, 'Other'),
        paymentMethodId: payments.resolve(e.payment, 'Other'),
      })
    }

    for (const e of arr(yd.incomes).filter(isObj)) {
      data.incomes.push({
        id: id(e.id),
        name: str(e.name),
        amount: eurosToCents(e.amount),
        date: date(e.date, firstOfYear),
        categoryId: categories.resolve(e.category, 'Other'),
        paymentMethodId: payments.resolve(e.payment, 'Other'),
      })
    }

    for (const s of arr(yd.simulations).filter(isObj)) {
      const month = Number(s.monthIndex)
      data.simulations.push({
        id: id(s.id),
        name: str(s.name),
        amount: eurosToCents(s.amount),
        year,
        month: Number.isInteger(month) && month >= 0 && month < 12 ? month : 0,
      })
    }

    for (const l of arr(yd.loans).filter(isObj)) {
      const loanDate = date(l.date, firstOfYear)
      data.loans.push({
        id: id(l.id),
        name: str(l.name),
        amount: eurosToCents(l.amount),
        type: l.type === 'received' ? 'received' : 'given',
        date: loanDate,
        notes: str(l.notes),
        repayments: arr(l.repayments)
          .filter(isObj)
          .map((r) => ({ id: id(r.id), amount: eurosToCents(r.amount), date: date(r.date, loanDate) })),
      })
    }
  }
  return data
}

function normalizeTags(source: unknown): Tag[] {
  const tags: Tag[] = []
  for (const t of arr(source).filter(isObj)) {
    const name = str(t.name).trim()
    if (!name || tags.some((x) => x.name === name)) continue
    tags.push({ id: id(t.id), name, color: isHexColor(t.color) ? t.color : pickUniqueColor(tags.map((x) => x.color)) })
  }
  return tags
}

/** Valida un backup v2: le voci malformate vengono scartate invece di corrompere i dati. */
function normalizeV2(raw: Obj): FinanceData {
  const today = todayIso()
  const valid = <T>(items: unknown, map: (o: Obj) => T | null): T[] =>
    arr(items)
      .filter(isObj)
      .map(map)
      .filter((x): x is T => x !== null)

  return {
    schemaVersion: 2,
    categories: normalizeTags(raw.categories),
    paymentMethods: normalizeTags(raw.paymentMethods),
    oneTimeExpenses: valid<OneTimeExpense>(raw.oneTimeExpenses, (o) => {
      const amount = cents(o.amount)
      if (amount === null || !isValidIsoDate(o.date)) return null
      return {
        id: id(o.id),
        name: str(o.name),
        amount,
        date: o.date,
        categoryId: str(o.categoryId),
        paymentMethodId: str(o.paymentMethodId),
        notes: str(o.notes),
      }
    }),
    recurringExpenses: valid<RecurringExpense>(raw.recurringExpenses, (o) => {
      const amount = cents(o.amount)
      if (amount === null || !isValidIsoDate(o.startDate)) return null
      return {
        id: id(o.id),
        name: str(o.name),
        amount,
        frequency: FREQUENCIES.includes(o.frequency as Frequency) ? (o.frequency as Frequency) : 'monthly',
        startDate: o.startDate,
        endDate: isValidIsoDate(o.endDate) ? o.endDate : null,
        categoryId: str(o.categoryId),
        paymentMethodId: str(o.paymentMethodId),
      }
    }),
    incomes: valid<Income>(raw.incomes, (o) => {
      const amount = cents(o.amount)
      if (amount === null || !isValidIsoDate(o.date)) return null
      return {
        id: id(o.id),
        name: str(o.name),
        amount,
        date: o.date,
        categoryId: str(o.categoryId),
        paymentMethodId: str(o.paymentMethodId),
      }
    }),
    loans: valid<Loan>(raw.loans, (o) => {
      const amount = cents(o.amount)
      if (amount === null) return null
      return {
        id: id(o.id),
        name: str(o.name),
        amount,
        type: o.type === 'received' ? 'received' : 'given',
        date: date(o.date, today),
        notes: str(o.notes),
        repayments: valid<Repayment>(o.repayments, (r) => {
          const a = cents(r.amount)
          return a === null ? null : { id: id(r.id), amount: a, date: date(r.date, today) }
        }),
      }
    }),
    simulations: valid<Simulation>(raw.simulations, (o) => {
      const amount = cents(o.amount)
      const year = Number(o.year)
      const month = Number(o.month)
      if (amount === null || !Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) return null
      return { id: id(o.id), name: str(o.name), amount, year, month }
    }),
  }
}

/**
 * Accetta qualsiasi formato di dati noto e lo porta allo schema corrente:
 * - schema v2 (questa app);
 * - prototipo multi-anno (`finances_tracker_multiyr`, con `years`);
 * - prototipo mono-anno più vecchio (`finances_tracker_2026`).
 */
export function parseBackup(raw: unknown): FinanceData {
  if (!isObj(raw)) throw new BackupFormatError('not an object')
  if (raw.schemaVersion === 2) return normalizeV2(raw)
  if (isObj(raw.years)) return migrateV1(raw)
  if (Array.isArray(raw.oneTimeExpenses)) {
    return migrateV1({ categories: raw.categories, paymentMethods: raw.paymentMethods, years: { '2026': raw } })
  }
  throw new BackupFormatError('unknown format')
}
