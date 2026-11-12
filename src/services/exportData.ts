/**
 * Servizio di esportazione tabellare dei dati di Pocketly.
 * Organizza i dati esattamente come l'applicazione:
 * - Spese variabili
 * - Spese ricorrenti
 * - Entrate
 * - Prestiti
 * - Categorie e metodi
 *
 * Supporta:
 * 1. Formato Excel (.xlsx) con fogli di lavoro (tabs) separati e formattati
 * 2. Archivio ZIP con i singoli file CSV separati
 * 3. Singoli file CSV per specifica sezione
 */

import type { FinanceData, Frequency, Loan } from '@/types/models'
import { isActiveInYear } from '@/domain/recurrence'
import { loanStatus } from '@/domain/calculations'
import { formatRulesSummary } from '@/domain/notifications'
import { parseIsoDate } from '@/utils/dates'
import { buildXlsxWorkbook, type CellScalar, type SheetDefinition } from './xlsx/writer'
import { createZipArchive } from './xlsx/zipWriter'

export type ExportFormat = 'xlsx' | 'zip' | 'onetime' | 'income' | 'recurring' | 'loans'

export interface ExportOptions {
  year?: number | 'all'
  locale?: string
}

export interface SectionTable {
  id: 'onetime' | 'income' | 'recurring' | 'loans' | 'settings'
  sheetName: string
  csvFilename: string
  headers: string[]
  rows: CellScalar[][]
}

function escapeCsvField(val: CellScalar, delimiter: string, decimalSep: string): string {
  if (val === null || val === undefined) return ''
  let s: string
  if (typeof val === 'number') {
    s = val.toFixed(2)
    if (decimalSep === ',') s = s.replace('.', ',')
  } else {
    s = String(val)
  }
  if (s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function tableToCsv(headers: string[], rows: CellScalar[][], isIt: boolean): string {
  const delimiter = isIt ? ';' : ','
  const decimalSep = isIt ? ',' : '.'
  const lines: string[] = []

  // Intestazione
  lines.push(headers.map((h) => escapeCsvField(h, delimiter, decimalSep)).join(delimiter))

  // Righe
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvField(cell, delimiter, decimalSep)).join(delimiter))
  }

  // BOM UTF-8 per compatibilità totale con Excel
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

/**
 * Estrae e organizza i dati delle 5 sezioni in tabelle pulite con righe e colonne corrispondenti all'app.
 */
export function extractSectionTables(data: FinanceData, options: ExportOptions = {}): SectionTable[] {
  const isIt = (options.locale ?? 'it').startsWith('it')
  const catMap = new Map(data.categories.map((c) => [c.id, c.name]))
  const payMap = new Map(data.paymentMethods.map((p) => [p.id, p.name]))
  const tagMap = new Map(data.tags.map((t) => [t.id, t.name]))

  const selectedYear = options.year && options.year !== 'all' ? options.year : null

  // 1. Spese variabili
  const onetimeFiltered = data.oneTimeExpenses
    .filter((e) => (selectedYear ? parseIsoDate(e.date).year === selectedYear : true))
    .sort((a, b) => b.date.localeCompare(a.date))

  const onetimeRows: CellScalar[][] = onetimeFiltered.map((e) => [
    e.date,
    e.name,
    e.amount / 100,
    catMap.get(e.categoryId) ?? '',
    payMap.get(e.paymentMethodId) ?? '',
    (e.tagIds ?? []).map((id) => tagMap.get(id) ?? '').filter(Boolean).join(', '),
    e.notes ?? '',
  ])

  const onetimeTable: SectionTable = {
    id: 'onetime',
    sheetName: isIt ? 'Spese variabili' : 'Variable expenses',
    csvFilename: isIt ? 'spese-variabili.csv' : 'variable-expenses.csv',
    headers: isIt
      ? ['Data', 'Nome', 'Importo (€)', 'Categoria', 'Metodo di pagamento', 'Tag', 'Note']
      : ['Date', 'Name', 'Amount (€)', 'Category', 'Payment method', 'Tags', 'Notes'],
    rows: onetimeRows,
  }

  // 2. Spese ricorrenti
  const freqLabels: Record<Frequency, string> = isIt
    ? { monthly: 'Mensile', quarterly: 'Trimestrale', semiannual: 'Semestrale', annual: 'Annuale' }
    : { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semi-annual', annual: 'Annual' }

  const dummyT = (key: string, params?: Record<string, unknown>) => {
    if (key === 'notifications.daysBefore.sameDay') return isIt ? 'il giorno stesso' : 'on the day'
    if (key === 'notifications.daysBefore.oneDayBefore') return isIt ? '1 giorno prima' : '1 day before'
    if (key === 'notifications.daysBefore.daysBefore') return isIt ? `${String(params?.days ?? '')} giorni prima` : `${String(params?.days ?? '')} days before`
    if (key === 'notifications.ruleSummary') return isIt ? `${String(params?.days ?? '')} alle ${String(params?.time ?? '')}` : `${String(params?.days ?? '')} at ${String(params?.time ?? '')}`
    return ''
  }

  const recurringFiltered = data.recurringExpenses
    .filter((r) => (selectedYear ? isActiveInYear(r, selectedYear) : true))
    .sort((a, b) => a.name.localeCompare(b.name))

  const recurringRows: CellScalar[][] = recurringFiltered.map((r) => [
    r.name,
    r.amount / 100,
    freqLabels[r.frequency] ?? r.frequency,
    r.startDate,
    r.endDate ?? '',
    catMap.get(r.categoryId) ?? '',
    payMap.get(r.paymentMethodId) ?? '',
    r.notifications?.length ? formatRulesSummary(r.notifications, dummyT) : '',
  ])

  const recurringTable: SectionTable = {
    id: 'recurring',
    sheetName: isIt ? 'Spese ricorrenti' : 'Recurring expenses',
    csvFilename: isIt ? 'spese-ricorrenti.csv' : 'recurring-expenses.csv',
    headers: isIt
      ? ['Nome', 'Importo (€)', 'Frequenza', 'Data inizio', 'Data fine', 'Categoria', 'Metodo di pagamento', 'Promemoria']
      : ['Name', 'Amount (€)', 'Frequency', 'Start date', 'End date', 'Category', 'Payment method', 'Reminders'],
    rows: recurringRows,
  }

  // 3. Entrate
  const incomesFiltered = data.incomes
    .filter((i) => (selectedYear ? parseIsoDate(i.date).year === selectedYear : true))
    .sort((a, b) => b.date.localeCompare(a.date))

  const incomeRows: CellScalar[][] = incomesFiltered.map((i) => [
    i.date,
    i.name,
    i.amount / 100,
    catMap.get(i.categoryId) ?? '',
    payMap.get(i.paymentMethodId) ?? '',
    (i.tagIds ?? []).map((id) => tagMap.get(id) ?? '').filter(Boolean).join(', '),
    i.notes ?? '',
  ])

  const incomeTable: SectionTable = {
    id: 'income',
    sheetName: isIt ? 'Entrate' : 'Income',
    csvFilename: isIt ? 'entrate.csv' : 'income.csv',
    headers: isIt
      ? ['Data', 'Nome', 'Importo (€)', 'Categoria', 'Metodo di pagamento', 'Tag', 'Note']
      : ['Date', 'Name', 'Amount (€)', 'Category', 'Payment method', 'Tags', 'Notes'],
    rows: incomeRows,
  }

  // 4. Prestiti
  const loansSorted = [...data.loans].sort((a, b) => b.date.localeCompare(a.date))
  const loanRows: CellScalar[][] = loansSorted.map((l: Loan) => {
    const st = loanStatus(l)
    const typeLabel = l.type === 'given' ? (isIt ? 'Dato' : 'Given') : isIt ? 'Ricevuto' : 'Received'
    const statusLabel = st.remaining === 0 ? (isIt ? 'Saldato' : 'Settled') : isIt ? 'In corso' : 'Active'
    const repDetail = (l.repayments ?? [])
      .map((r) => `${r.date}: ${(r.amount / 100).toFixed(2)} €`)
      .join('; ')

    return [
      l.name,
      l.amount / 100,
      typeLabel,
      l.date,
      st.repaid / 100,
      st.remaining / 100,
      statusLabel,
      l.notes ?? '',
      repDetail,
    ]
  })

  const loansTable: SectionTable = {
    id: 'loans',
    sheetName: isIt ? 'Prestiti' : 'Loans',
    csvFilename: isIt ? 'prestiti.csv' : 'loans.csv',
    headers: isIt
      ? ['Nome', 'Importo (€)', 'Tipo', 'Data', 'Rimborsato (€)', 'Residuo (€)', 'Stato', 'Note', 'Dettaglio rimborsi']
      : ['Name', 'Amount (€)', 'Type', 'Date', 'Repaid (€)', 'Remaining (€)', 'Status', 'Notes', 'Repayments detail'],
    rows: loanRows,
  }

  // 5. Categorie, Metodi e Tag
  const settingsRows: CellScalar[][] = [
    ...data.categories.map((c) => [isIt ? 'Categoria' : 'Category', c.name, c.color]),
    ...data.paymentMethods.map((p) => [isIt ? 'Metodo di pagamento' : 'Payment method', p.name, p.color]),
    ...data.tags.map((t) => [isIt ? 'Tag' : 'Tag', t.name, t.color]),
  ]

  const settingsTable: SectionTable = {
    id: 'settings',
    sheetName: isIt ? 'Categorie e metodi' : 'Settings',
    csvFilename: isIt ? 'categorie-e-metodi.csv' : 'settings.csv',
    headers: isIt ? ['Tipo', 'Nome', 'Colore'] : ['Type', 'Name', 'Color'],
    rows: settingsRows,
  }

  return [onetimeTable, recurringTable, incomeTable, loansTable, settingsTable]
}

export interface ExportResult {
  blob: Blob
  filename: string
  mimeType: string
}

/**
 * Esporta i dati in un file Excel (.xlsx) con fogli di calcolo separati per ogni sezione.
 */
export async function exportToXlsx(data: FinanceData, options: ExportOptions = {}): Promise<ExportResult> {
  const tables = extractSectionTables(data, options)
  const sheets: SheetDefinition[] = tables.map((t) => ({
    name: t.sheetName,
    headers: t.headers,
    rows: t.rows,
  }))

  const bytes = await buildXlsxWorkbook(sheets)
  const yearSuffix = options.year && options.year !== 'all' ? String(options.year) : 'tutti-gli-anni'
  const filename = `pocketly-${yearSuffix}.xlsx`
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const blob = new Blob([bytes as BlobPart], { type: mimeType })

  return { blob, filename, mimeType }
}

/**
 * Esporta tutte le sezioni come file CSV separati all'interno di un archivio .zip.
 */
export async function exportToCsvZip(data: FinanceData, options: ExportOptions = {}): Promise<ExportResult> {
  const isIt = (options.locale ?? 'it').startsWith('it')
  const tables = extractSectionTables(data, options)
  const files: Record<string, string> = {}

  for (const table of tables) {
    files[table.csvFilename] = tableToCsv(table.headers, table.rows, isIt)
  }

  const zipBytes = await createZipArchive(files, true)
  const yearSuffix = options.year && options.year !== 'all' ? String(options.year) : 'tutti-gli-anni'
  const filename = `pocketly-fogli-${yearSuffix}.zip`
  const mimeType = 'application/zip'
  const blob = new Blob([zipBytes as BlobPart], { type: mimeType })

  return { blob, filename, mimeType }
}

/**
 * Esporta una specifica sezione in un singolo file CSV pulito.
 */
export function exportSectionToCsv(
  sectionId: 'onetime' | 'income' | 'recurring' | 'loans',
  data: FinanceData,
  options: ExportOptions = {},
): ExportResult {
  const isIt = (options.locale ?? 'it').startsWith('it')
  const tables = extractSectionTables(data, options)
  const table = tables.find((t) => t.id === sectionId) ?? tables[0]!
  const csvContent = tableToCsv(table.headers, table.rows, isIt)

  const yearSuffix = options.year && options.year !== 'all' ? `-${options.year}` : ''
  const filename = `pocketly-${table.csvFilename.replace('.csv', '')}${yearSuffix}.csv`
  const mimeType = 'text/csv;charset=utf-8'
  const blob = new Blob([csvContent], { type: mimeType })

  return { blob, filename, mimeType }
}

/**
 * Esegue l'esportazione secondo il formato scelto.
 */
export async function executeExport(
  format: ExportFormat,
  data: FinanceData,
  options: ExportOptions = {},
): Promise<ExportResult> {
  if (format === 'xlsx') return exportToXlsx(data, options)
  if (format === 'zip') return exportToCsvZip(data, options)
  return exportSectionToCsv(format, data, options)
}

/**
 * Verifica se il browser supporta la condivisione nativa dei file.
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false
  try {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

/**
 * Scarica il file esportato nel browser.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Condivide il file tramite Web Share API o effettua il download come ripiego.
 */
export async function shareOrDownloadFile(result: ExportResult, mode: 'share' | 'download'): Promise<'shared' | 'downloaded'> {
  if (mode === 'share' && canShareFiles()) {
    try {
      const file = new File([result.blob], result.filename, { type: result.mimeType })
      await navigator.share({
        files: [file],
        title: result.filename,
      })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e
      // Fallback a download in caso di errore della share sheet
      triggerDownload(result.blob, result.filename)
      return 'downloaded'
    }
  }

  triggerDownload(result.blob, result.filename)
  return 'downloaded'
}
