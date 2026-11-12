import type { FinanceData } from '@/types/models'
import { dueDateIn } from '@/domain/recurrence'
import { availableYears } from '@/domain/calculations'
import { parseIsoDate } from '@/utils/dates'

export interface CsvExportOptions {
  year?: number | 'all'
  locale?: string
}

function escapeCsv(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Genera il contenuto CSV dei movimenti con BOM UTF-8 per la massima compatibilità con Excel.
 * Formatta separatori e decimali in base alla lingua (IT usa ';' e ',', EN usa ',' e '.').
 */
export function generateCsv(data: FinanceData, options: CsvExportOptions = {}): string {
  const isIt = (options.locale ?? 'it').startsWith('it')
  const delimiter = isIt ? ';' : ','
  const decimalSep = isIt ? ',' : '.'

  const formatAmount = (cents: number): string => {
    const formatted = (cents / 100).toFixed(2)
    return decimalSep === ',' ? formatted.replace('.', ',') : formatted
  }

  const catMap = new Map(data.categories.map((c) => [c.id, c.name]))
  const payMap = new Map(data.paymentMethods.map((p) => [p.id, p.name]))
  const tagMap = new Map(data.tags.map((t) => [t.id, t.name]))

  const currentYear = new Date().getFullYear()
  const years = options.year && options.year !== 'all' ? [options.year] : availableYears(data, currentYear)

  interface CsvRow {
    date: string
    type: string
    name: string
    amount: string
    category: string
    paymentMethod: string
    tags: string
    notes: string
  }

  const rows: CsvRow[] = []

  // Spese una tantum
  for (const e of data.oneTimeExpenses) {
    const y = parseIsoDate(e.date).year
    if (options.year && options.year !== 'all' && y !== options.year) continue
    rows.push({
      date: e.date,
      type: isIt ? 'Spesa variabile' : 'Variable expense',
      name: e.name,
      amount: formatAmount(e.amount),
      category: catMap.get(e.categoryId) ?? '',
      paymentMethod: payMap.get(e.paymentMethodId) ?? '',
      tags: (e.tagIds ?? []).map((id) => tagMap.get(id) ?? '').filter(Boolean).join(', '),
      notes: e.notes ?? '',
    })
  }

  // Spese ricorrenti (occorrenze negli anni considerati)
  for (const r of data.recurringExpenses) {
    for (const y of years) {
      for (let m = 0; m < 12; m++) {
        const due = dueDateIn(r, y, m)
        if (due) {
          rows.push({
            date: due,
            type: isIt ? 'Spesa ricorrente' : 'Recurring expense',
            name: r.name,
            amount: formatAmount(r.amount),
            category: catMap.get(r.categoryId) ?? '',
            paymentMethod: payMap.get(r.paymentMethodId) ?? '',
            tags: '',
            notes: '',
          })
        }
      }
    }
  }

  // Entrate
  for (const i of data.incomes) {
    const y = parseIsoDate(i.date).year
    if (options.year && options.year !== 'all' && y !== options.year) continue
    rows.push({
      date: i.date,
      type: isIt ? 'Entrata' : 'Income',
      name: i.name,
      amount: formatAmount(i.amount),
      category: catMap.get(i.categoryId) ?? '',
      paymentMethod: payMap.get(i.paymentMethodId) ?? '',
      tags: (i.tagIds ?? []).map((id) => tagMap.get(id) ?? '').filter(Boolean).join(', '),
      notes: i.notes ?? '',
    })
  }

  // Prestiti e rimborsi
  for (const l of data.loans) {
    const ly = parseIsoDate(l.date).year
    if (!options.year || options.year === 'all' || ly === options.year) {
      const typeLabel =
        l.type === 'given'
          ? isIt
            ? 'Prestito concesso'
            : 'Loan given'
          : isIt
            ? 'Prestito ricevuto'
            : 'Loan received'
      rows.push({
        date: l.date,
        type: typeLabel,
        name: l.name,
        amount: formatAmount(l.amount),
        category: '',
        paymentMethod: '',
        tags: '',
        notes: l.notes ?? '',
      })
    }

    for (const rep of l.repayments) {
      const ry = parseIsoDate(rep.date).year
      if (!options.year || options.year === 'all' || ry === options.year) {
        rows.push({
          date: rep.date,
          type: isIt ? 'Rimborso prestito' : 'Loan repayment',
          name: l.name,
          amount: formatAmount(rep.amount),
          category: '',
          paymentMethod: '',
          tags: '',
          notes: isIt ? `Rimborso per ${l.name}` : `Repayment for ${l.name}`,
        })
      }
    }
  }

  // Ordinamento cronologico per data crescente, poi per nome
  rows.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date)
    if (cmp !== 0) return cmp
    return a.name.localeCompare(b.name)
  })

  // Intestazioni colonne
  const headers = isIt
    ? ['Data', 'Tipo', 'Nome', 'Importo (€)', 'Categoria', 'Metodo di Pagamento', 'Tag', 'Note']
    : ['Date', 'Type', 'Name', 'Amount (€)', 'Category', 'Payment Method', 'Tags', 'Notes']

  const lines = [
    headers.map((h) => escapeCsv(h, delimiter)).join(delimiter),
    ...rows.map((r) =>
      [r.date, r.type, r.name, r.amount, r.category, r.paymentMethod, r.tags, r.notes]
        .map((val) => escapeCsv(val, delimiter))
        .join(delimiter),
    ),
  ]

  // BOM UTF-8 (\uFEFF) all'inizio per compatibilità immediata con Microsoft Excel
  return '\uFEFF' + lines.join('\r\n')
}

/**
 * Esporta il CSV aprendo il menu di condivisione nativo (Web Share) o avviando il download.
 */
export async function downloadOrShareCsv(
  csvContent: string,
  filename: string,
  mode: 'download' | 'share' = 'download',
): Promise<'downloaded' | 'shared' | 'cancelled'> {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  if (mode === 'share') {
    const file = new File([blob], filename, { type: 'text/csv;charset=utf-8;' })
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
        })
        return 'shared'
      } catch (e) {
        if ((e as Error).name === 'AbortError') return 'cancelled'
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
