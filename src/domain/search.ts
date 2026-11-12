import type { Cents, FinanceData, Frequency, Id, IsoDate, LoanType } from '@/types/models'
import { parseIsoDate } from '@/utils/dates'

export type SearchResultKind = 'onetime' | 'recurring' | 'income' | 'loan'

export interface SearchResult {
  id: Id
  kind: SearchResultKind
  name: string
  amount: Cents
  date?: IsoDate
  categoryId?: Id
  paymentMethodId?: Id
  tagIds?: Id[]
  notes?: string
  frequency?: Frequency
  loanType?: LoanType
  year?: number
  month?: number
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function amountStrings(cents: Cents): string {
  const euro = (cents / 100).toFixed(2)
  const euroComma = euro.replace('.', ',')
  const euroInt = String(Math.floor(cents / 100))
  return `${euro} ${euroComma} ${euroInt}`
}

/**
 * Cerca tra spese una tantum, ricorrenti, entrate e prestiti.
 * La query viene divisa in token: tutti i token devono essere presenti nel testo della voce
 * (nome, note, categoria, metodo di pagamento, tag, importo o data).
 * Supporta la ricerca insensibile a maiuscole e accenti (es. 'caffe' trova 'Caffè').
 */
export function searchFinance(data: FinanceData, query: string): SearchResult[] {
  const q = query.trim()
  if (!q) return []

  const tokens = q.split(/\s+/).filter(Boolean).map(normalize)
  if (tokens.length === 0) return []

  const catMap = new Map(data.categories.map((c) => [c.id, c.name]))
  const payMap = new Map(data.paymentMethods.map((p) => [p.id, p.name]))
  const tagMap = new Map(data.tags.map((t) => [t.id, t.name]))

  function matches(searchableText: string): boolean {
    const text = normalize(searchableText)
    return tokens.every((token) => text.includes(token))
  }

  const results: SearchResult[] = []

  // Spese una tantum
  for (const e of data.oneTimeExpenses) {
    const catName = catMap.get(e.categoryId) ?? ''
    const payName = payMap.get(e.paymentMethodId) ?? ''
    const tagNames = (e.tagIds ?? []).map((id) => tagMap.get(id) ?? '').join(' ')
    const searchable = `${e.name} ${e.notes ?? ''} ${catName} ${payName} ${tagNames} ${amountStrings(e.amount)} ${e.date}`

    if (matches(searchable)) {
      const { year, month } = parseIsoDate(e.date)
      results.push({
        id: e.id,
        kind: 'onetime',
        name: e.name,
        amount: e.amount,
        date: e.date,
        categoryId: e.categoryId,
        paymentMethodId: e.paymentMethodId,
        tagIds: e.tagIds,
        notes: e.notes,
        year,
        month,
      })
    }
  }

  // Spese ricorrenti
  for (const r of data.recurringExpenses) {
    const catName = catMap.get(r.categoryId) ?? ''
    const payName = payMap.get(r.paymentMethodId) ?? ''
    const searchable = `${r.name} ${catName} ${payName} ${amountStrings(r.amount)} ${r.startDate} ${r.endDate ?? ''}`

    if (matches(searchable)) {
      const { year } = parseIsoDate(r.startDate)
      results.push({
        id: r.id,
        kind: 'recurring',
        name: r.name,
        amount: r.amount,
        categoryId: r.categoryId,
        paymentMethodId: r.paymentMethodId,
        frequency: r.frequency,
        year,
      })
    }
  }

  // Entrate
  for (const i of data.incomes) {
    const catName = catMap.get(i.categoryId) ?? ''
    const payName = payMap.get(i.paymentMethodId) ?? ''
    const tagNames = (i.tagIds ?? []).map((id) => tagMap.get(id) ?? '').join(' ')
    const searchable = `${i.name} ${i.notes ?? ''} ${catName} ${payName} ${tagNames} ${amountStrings(i.amount)} ${i.date}`

    if (matches(searchable)) {
      const { year, month } = parseIsoDate(i.date)
      results.push({
        id: i.id,
        kind: 'income',
        name: i.name,
        amount: i.amount,
        date: i.date,
        categoryId: i.categoryId,
        paymentMethodId: i.paymentMethodId,
        tagIds: i.tagIds,
        notes: i.notes,
        year,
        month,
      })
    }
  }

  // Prestiti e rimborsi
  for (const l of data.loans) {
    const typeKeywords = l.type === 'given' ? 'prestito concesso dato credito' : 'prestito ricevuto preso debito'
    const repaymentsText = l.repayments.map((rep) => `${rep.date} ${amountStrings(rep.amount)}`).join(' ')
    const searchable = `${l.name} ${l.notes ?? ''} ${amountStrings(l.amount)} ${l.date} ${typeKeywords} ${repaymentsText}`

    if (matches(searchable)) {
      const { year, month } = parseIsoDate(l.date)
      results.push({
        id: l.id,
        kind: 'loan',
        name: l.name,
        amount: l.amount,
        date: l.date,
        loanType: l.type,
        notes: l.notes,
        year,
        month,
      })
    }
  }

  // Ordinamento: date più recenti prima; se pari per nome; ricorrenti alla fine per nome
  results.sort((a, b) => {
    if (a.date && b.date) {
      const cmp = b.date.localeCompare(a.date)
      if (cmp !== 0) return cmp
    } else if (a.date && !b.date) {
      return -1
    } else if (!a.date && b.date) {
      return 1
    }
    return a.name.localeCompare(b.name)
  })

  return results
}
