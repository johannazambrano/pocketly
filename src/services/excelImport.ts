/**
 * Converte il foglio Excel "Expense Tracker" nei dati di Pocketly (schema v2), direttamente nel browser.
 * È la stessa conversione di `scripts/xlsx_to_pocketly.py`, con gli stessi ID: importare lo stesso file
 * dall'app o dallo script dà lo stesso risultato.
 *
 * Mappatura:
 * - "One-time"  -> oneTimeExpenses. Senza Data si usa il giorno `defaultDay` del primo mese in "Mese".
 * - "Income"    -> incomes (stessa regola per la data).
 * - "Recurring" -> recurringExpenses. Inizio = "Data Inizio", altrimenti il primo mese elencato in "Mese".
 *                  Se l'ultimo mese elencato non è dicembre la ricorrenza termina alla fine di quel mese.
 * - Categorie e metodi di pagamento: dal foglio Settings più quelli usati nei dati.
 * - Non supportati e quindi ignorati: Tag, Fonte, Prelievo su (come conto), frequenza Weekly, Prestiti.
 */
import type { FinanceData, Frequency, Income, OneTimeExpense, RecurringExpense, Tag } from '@/types/models'
import { PALETTE } from '@/utils/colors'
import { uuidv5 } from '@/utils/uuidv5'
import { isCellDate, readWorkbook, type CellValue, type Sheet, type Workbook } from './xlsx/workbook'

/** Stesso namespace dello script Python: non va cambiato, altrimenti cambiano tutti gli ID. */
const POCKETLY_NAMESPACE = '7b38d648-52e6-4277-bf30-4e4b52df33ce'

const FREQUENCIES: Record<string, Frequency> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  'semi-annual': 'semiannual',
  annual: 'annual',
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

export type ImportWarningCode =
  | 'monthUnknown'
  | 'missingDate'
  | 'dateFromMonth'
  | 'tagIgnored'
  | 'recurringIncomplete'
  | 'frequencyUnsupported'
  | 'recurringNoStart'
  | 'annualManyMonths'
  | 'loansSkipped'

export interface ImportWarning {
  code: ImportWarningCode
  params: Record<string, string | number>
}

export interface ExcelImportStats {
  categories: number
  paymentMethods: number
  oneTimeExpenses: number
  recurringExpenses: number
  incomes: number
}

export interface ExcelImportResult {
  data: FinanceData
  stats: ExcelImportStats
  warnings: ImportWarning[]
}

/** Il file si apre ma non contiene nessuno dei fogli attesi (One-time, Income, Recurring). */
export class NotExpenseTrackerError extends Error {
  constructor() {
    super('Il file non contiene i fogli One-time, Income o Recurring')
    this.name = 'NotExpenseTrackerError'
  }
}

const stableId = (seed: string) => uuidv5(seed, POCKETLY_NAMESPACE)

/** Equivalente di `round(v * 100)` in Python, che arrotonda i .5 al pari. */
function cents(v: CellValue | undefined): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const x = v * 100
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : r
}

function clean(v: CellValue | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  if (isCellDate(v)) return v.date
  return String(v).trim()
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const iso = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m + 1)}-${pad(d)}`
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

function isValidIso(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo - 1)
}

function toIso(v: CellValue | undefined): string | null {
  if (v === null || v === undefined) return null
  if (isCellDate(v)) return v.date
  if (typeof v === 'string') {
    const s = v.trim()
    return isValidIso(s) ? s : null
  }
  return null
}

class Tags {
  readonly items: Tag[] = []
  private readonly byKey = new Map<string, Tag>()

  constructor(
    private readonly prefix: string,
    private readonly offset: number,
  ) {}

  add(name: string): string {
    const key = name.toLowerCase()
    let tag = this.byKey.get(key)
    if (!tag) {
      tag = {
        id: stableId(`${this.prefix}:${key}`),
        name,
        color: PALETTE[(this.items.length + this.offset) % PALETTE.length]!,
      }
      this.items.push(tag)
      this.byKey.set(key, tag)
    }
    return tag.id
  }
}

function findSheet(wb: Workbook, fragment: string): Sheet | undefined {
  return wb.sheets.find((s) => s.name.toLowerCase().includes(fragment))
}

/** Righe sotto l'intestazione (riga 2) come { intestazione: valore }, fino alla riga TOTALE. */
function* rowsWithHeader(ws: Sheet, headerRow = 2): Generator<[number, Record<string, CellValue>]> {
  const header = ws.rows.get(headerRow) ?? []
  const headers = Array.from({ length: header.length }, (_, i) => clean(header[i]))
  for (let n = headerRow + 1; n <= ws.maxRow; n++) {
    const row = ws.rows.get(n) ?? []
    if (clean(row[0]).toUpperCase() === 'TOTALE') break
    const out: Record<string, CellValue> = {}
    headers.forEach((h, i) => {
      if (h) out[h] = row[i] ?? null
    })
    yield [n, out]
  }
}

/** Conteggio delle voci con la stessa firma, per dare ID diversi a voci identiche (due caffè nello stesso giorno). */
function counter() {
  const seen = new Map<string, number>()
  return (sig: string) => {
    const n = (seen.get(sig) ?? 0) + 1
    seen.set(sig, n)
    return n
  }
}

export function convertWorkbook(wb: Workbook, defaultDay = 1): ExcelImportResult {
  const warnings: ImportWarning[] = []
  const warn = (code: ImportWarningCode, params: ImportWarning['params'] = {}) => warnings.push({ code, params })

  const oneTimeSheet = findSheet(wb, 'one-time')
  const incomeSheet = findSheet(wb, 'income')
  const recurringSheet = findSheet(wb, 'recurring')
  if (!oneTimeSheet && !incomeSheet && !recurringSheet) throw new NotExpenseTrackerError()

  const categories = new Tags('cat', 0)
  const payments = new Tags('pm', 8)

  const settings = findSheet(wb, 'settings')
  if (settings) {
    for (let n = 4; n <= 19; n++) {
      const row = settings.rows.get(n) ?? []
      if (clean(row[0])) categories.add(clean(row[0]))
      if (clean(row[3])) payments.add(clean(row[3]))
    }
  }

  const dayOf = (y: number, m: number) => Math.min(defaultDay, daysInMonth(y, m))

  /** "January 2026, March 2026" -> [[2026, 0], [2026, 2]] ordinati e senza doppioni. */
  function parseMonths(value: CellValue | undefined, sheet: string, row: number): [number, number][] {
    // Una cella formattata come data (es. "ottobre 2026") vale come il suo mese.
    if (value && isCellDate(value)) return [[Number(value.date.slice(0, 4)), Number(value.date.slice(5, 7)) - 1]]
    const out = new Map<string, [number, number]>()
    for (const raw of clean(value).split(',')) {
      const part = raw.trim()
      if (!part) continue
      const m = /^([a-z]+)\s+(\d{4})$/i.exec(part)
      const month = m ? MONTHS.indexOf(m[1]!.toLowerCase()) : -1
      if (!m || month < 0) {
        warn('monthUnknown', { sheet, row, value: part })
        continue
      }
      const y = Number(m[2])
      out.set(`${y}-${month}`, [y, month])
    }
    return [...out.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  }

  function resolveDate(r: Record<string, CellValue>, sheet: string, n: number): string | null {
    const d = toIso(r.Data)
    if (d) return d
    const months = parseMonths(r.Mese, sheet, n)
    if (!months.length) {
      warn('missingDate', { sheet, row: n })
      return null
    }
    const [y, m] = months[0]!
    const date = iso(y, m, dayOf(y, m))
    warn('dateFromMonth', { sheet, row: n, name: clean(r.Nome), date })
    return date
  }

  const oneTime: OneTimeExpense[] = []
  if (oneTimeSheet) {
    const occurrence = counter()
    for (const [n, r] of rowsWithHeader(oneTimeSheet)) {
      const amount = cents(r['Importo (€)'])
      const name = clean(r.Nome)
      if (!name || amount === null) continue
      const date = resolveDate(r, 'One-time', n)
      if (!date) continue
      const key = name.toLowerCase()
      const k = occurrence(`${date}\u0000${key}\u0000${amount}`)
      oneTime.push({
        id: stableId(`ot:${date}:${key}:${amount}:${k}`),
        name,
        amount,
        date,
        categoryId: categories.add(clean(r.Categoria) || 'Other'),
        paymentMethodId: payments.add(clean(r['Metodo Pagamento']) || 'Other'),
        notes: clean(r.Note),
        tagIds: [],
      })
      if (clean(r.Tag)) warn('tagIgnored', { row: n, tag: clean(r.Tag) })
    }
  }

  const incomes: Income[] = []
  if (incomeSheet) {
    const occurrence = counter()
    for (const [n, r] of rowsWithHeader(incomeSheet)) {
      const amount = cents(r['Importo (€)'])
      const name = clean(r.Nome)
      if (!name || amount === null) continue
      const date = resolveDate(r, 'Income', n)
      if (!date) continue
      const key = name.toLowerCase()
      const k = occurrence(`${date}\u0000${key}\u0000${amount}`)
      incomes.push({
        id: stableId(`in:${date}:${key}:${amount}:${k}`),
        name,
        amount,
        date,
        categoryId: categories.add(clean(r.Categoria) || 'Other'),
        paymentMethodId: payments.add(clean(r['Prelievo su']) || 'Other'),
      })
    }
  }

  const recurring: RecurringExpense[] = []
  if (recurringSheet) {
    const occurrence = counter()
    for (const [n, r] of rowsWithHeader(recurringSheet)) {
      const amount = cents(r['Importo (€)'])
      const name = clean(r.Nome)
      if (!name || amount === null) {
        if (name || amount !== null) warn('recurringIncomplete', { row: n })
        continue
      }
      const frequency = FREQUENCIES[clean(r.Frequenza).toLowerCase()]
      if (!frequency) {
        warn('frequencyUnsupported', { row: n, name, frequency: clean(r.Frequenza) })
        continue
      }
      const months = parseMonths(r.Mese, 'Recurring', n)
      const explicitStart = toIso(r['Data Inizio'])
      let start: string
      let end: string | null = null
      if (explicitStart) {
        start = explicitStart
      } else if (months.length) {
        const [y0, m0] = months[0]!
        const [y1, m1] = months[months.length - 1]!
        start = iso(y0, m0, dayOf(y0, m0))
        // Mesi elencati fino a dicembre = ricorrenza ancora aperta; altrimenti finisce a fine mese.
        end = m1 === 11 || frequency === 'annual' ? null : iso(y1, m1, daysInMonth(y1, m1))
      } else {
        warn('recurringNoStart', { row: n, name })
        continue
      }
      if (explicitStart && months.length > 1 && frequency === 'annual') {
        warn('annualManyMonths', { row: n, name, count: months.length })
      }
      const key = name.toLowerCase()
      const k = occurrence(`${key}\u0000${amount}\u0000${frequency}\u0000${start}`)
      recurring.push({
        id: stableId(`rec:${key}:${amount}:${frequency}:${start}:${k}`),
        name,
        amount,
        frequency,
        startDate: start,
        endDate: end,
        categoryId: categories.add(clean(r.Categoria) || 'Other'),
        paymentMethodId: payments.add(clean(r['Metodo Pagamento']) || 'Other'),
      })
    }
  }

  const loans = findSheet(wb, 'prestiti')
  if (loans) {
    const filled = [...loans.rows.keys()].filter((n) => n >= 4).length
    if (filled) warn('loansSkipped', { count: filled })
  }

  const data: FinanceData = {
    schemaVersion: 2,
    categories: categories.items,
    paymentMethods: payments.items,
    tags: [],
    oneTimeExpenses: oneTime,
    recurringExpenses: recurring,
    incomes,
    loans: [],
    simulations: [],
    forecast: { estimateIncome: false, incomeCategoryIds: [] },
    budget: { limits: {} },
  }

  return {
    data,
    stats: {
      categories: data.categories.length,
      paymentMethods: data.paymentMethods.length,
      oneTimeExpenses: oneTime.length,
      recurringExpenses: recurring.length,
      incomes: incomes.length,
    },
    warnings,
  }
}

/** Limite di sicurezza: un Expense Tracker pesa poche centinaia di KB. */
export const MAX_EXCEL_FILE_SIZE = 20 * 1024 * 1024

export async function readExcelFile(file: Blob, defaultDay = 1): Promise<ExcelImportResult> {
  if (file.size > MAX_EXCEL_FILE_SIZE) throw new RangeError('file too large')
  const bytes = new Uint8Array(await file.arrayBuffer())
  return convertWorkbook(await readWorkbook(bytes), defaultDay)
}
