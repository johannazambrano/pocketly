import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/models'
import { createDefaultData } from '@/domain/defaults'
import {
  executeExport,
  exportSectionToCsv,
  exportToCsvZip,
  exportToXlsx,
  extractSectionTables,
} from './exportData'
import { readWorkbook } from './xlsx/workbook'
import { openZip } from './xlsx/zip'

function createTestData(): FinanceData {
  const d = createDefaultData('it')
  const cat = d.categories[0]!
  const pay = d.paymentMethods[0]!
  const tag = { id: 'tag-1', name: 'casa', color: '#10b981' }
  d.tags.push(tag)

  d.oneTimeExpenses = [
    {
      id: 'e-1',
      name: 'Spesa Alimentari',
      amount: 4550, // 45.50 €
      date: '2026-05-10',
      categoryId: cat.id,
      paymentMethodId: pay.id,
      notes: 'Sconto cassa',
      tagIds: [tag.id],
    },
    {
      id: 'e-2',
      name: 'Libro vecchio',
      amount: 1500,
      date: '2024-03-01',
      categoryId: cat.id,
      paymentMethodId: pay.id,
      notes: '',
    },
  ]

  d.recurringExpenses = [
    {
      id: 'r-1',
      name: 'Palestra',
      amount: 5000,
      frequency: 'monthly',
      startDate: '2025-09-01',
      endDate: null,
      categoryId: cat.id,
      paymentMethodId: pay.id,
      notifications: [{ daysBefore: 1, time: '09:00' }],
    },
    {
      id: 'r-2',
      name: 'Assicurazione chiusa',
      amount: 30000,
      frequency: 'annual',
      startDate: '2023-01-01',
      endDate: '2024-12-31',
      categoryId: cat.id,
      paymentMethodId: pay.id,
    },
  ]

  d.incomes = [
    {
      id: 'i-1',
      name: 'Stipendio',
      amount: 180000,
      date: '2026-05-01',
      categoryId: cat.id,
      paymentMethodId: pay.id,
      notes: 'Bonus maggio',
      tagIds: [tag.id],
    },
  ]

  d.loans = [
    {
      id: 'l-1',
      name: 'Prestito Amico',
      amount: 20000,
      type: 'given',
      date: '2026-02-15',
      notes: 'Rate mensili',
      repayments: [{ id: 'rep-1', amount: 5000, date: '2026-03-15' }],
    },
  ]

  return d
}

describe('exportData (estrazione sezioni)', () => {
  it('organizza i dati in 5 sezioni separate e ordinate', () => {
    const data = createTestData()
    const tables = extractSectionTables(data, { year: 2026, locale: 'it' })

    expect(tables.length).toBe(5)

    // 1. Spese variabili: solo anno 2026
    const onetime = tables.find((t) => t.id === 'onetime')!
    expect(onetime.sheetName).toBe('Spese variabili')
    expect(onetime.rows.length).toBe(1)
    expect(onetime.rows[0]![1]).toBe('Spesa Alimentari')
    expect(onetime.rows[0]![2]).toBe(45.5)

    // 2. Spese ricorrenti: solo attive nel 2026 (Palestra sì, Assicurazione chiusa no)
    const recurring = tables.find((t) => t.id === 'recurring')!
    expect(recurring.sheetName).toBe('Spese ricorrenti')
    expect(recurring.rows.length).toBe(1)
    expect(recurring.rows[0]![0]).toBe('Palestra')
    expect(recurring.rows[0]![1]).toBe(50)
    expect(recurring.rows[0]![2]).toBe('Mensile')

    // 3. Entrate: solo anno 2026
    const income = tables.find((t) => t.id === 'income')!
    expect(income.sheetName).toBe('Entrate')
    expect(income.rows.length).toBe(1)
    expect(income.rows[0]![1]).toBe('Stipendio')
    expect(income.rows[0]![2]).toBe(1800)

    // 4. Prestiti
    const loans = tables.find((t) => t.id === 'loans')!
    expect(loans.sheetName).toBe('Prestiti')
    expect(loans.rows.length).toBe(1)
    expect(loans.rows[0]![0]).toBe('Prestito Amico')
    expect(loans.rows[0]![1]).toBe(200) // Importo totale
    expect(loans.rows[0]![4]).toBe(50) // Rimborsato
    expect(loans.rows[0]![5]).toBe(150) // Residuo

    // 5. Categorie e metodi
    const settings = tables.find((t) => t.id === 'settings')!
    expect(settings.sheetName).toBe('Categorie e metodi')
    expect(settings.rows.length).toBe(data.categories.length + data.paymentMethods.length + data.tags.length)
  })

  it('include tutti gli anni se year = all', () => {
    const data = createTestData()
    const tables = extractSectionTables(data, { year: 'all', locale: 'it' })

    const onetime = tables.find((t) => t.id === 'onetime')!
    expect(onetime.rows.length).toBe(2)

    const recurring = tables.find((t) => t.id === 'recurring')!
    expect(recurring.rows.length).toBe(2)
  })
})

describe('exportData (generazione Excel .xlsx)', () => {
  it('genera un file .xlsx con 5 fogli distinti leggibili dal lettore dell app', async () => {
    const data = createTestData()
    const res = await exportToXlsx(data, { year: 2026, locale: 'it' })

    expect(res.filename).toBe('pocketly-2026.xlsx')
    expect(res.mimeType).toContain('spreadsheetml.sheet')

    const arrayBuf = await res.blob.arrayBuffer()
    const wb = await readWorkbook(new Uint8Array(arrayBuf))

    expect(wb.sheets.length).toBe(5)
    expect(wb.sheets.map((s) => s.name)).toEqual([
      'Spese variabili',
      'Spese ricorrenti',
      'Entrate',
      'Prestiti',
      'Categorie e metodi',
    ])

    // Verifica contenuto del foglio Spese variabili
    const sVar = wb.sheets[0]!
    expect(sVar.rows.get(1)).toEqual(['Data', 'Nome', 'Importo (€)', 'Categoria', 'Metodo di pagamento', 'Tag', 'Note'])
    const r1 = sVar.rows.get(2)!
    expect(r1[0]).toBe('2026-05-10')
    expect(r1[1]).toBe('Spesa Alimentari')
    expect(r1[2]).toBe(45.5)
  })
})

describe('exportData (archivio ZIP di CSV e singoli CSV)', () => {
  it('genera un archivio .zip contenente i singoli file CSV', async () => {
    const data = createTestData()
    const res = await exportToCsvZip(data, { year: 2026, locale: 'it' })

    expect(res.filename).toBe('pocketly-fogli-2026.zip')
    expect(res.mimeType).toBe('application/zip')

    const arrayBuf = await res.blob.arrayBuffer()
    const zip = openZip(new Uint8Array(arrayBuf))

    expect(zip.has('spese-variabili.csv')).toBe(true)
    expect(zip.has('spese-ricorrenti.csv')).toBe(true)
    expect(zip.has('entrate.csv')).toBe(true)
    expect(zip.has('prestiti.csv')).toBe(true)
    expect(zip.has('categorie-e-metodi.csv')).toBe(true)

    const bytes = await zip.read('spese-variabili.csv')
    expect(bytes[0]).toBe(0xef)
    expect(bytes[1]).toBe(0xbb)
    expect(bytes[2]).toBe(0xbf)
    const textDec = new TextDecoder()
    const csvVar = textDec.decode(bytes)
    expect(csvVar).toContain('Spesa Alimentari')
    expect(csvVar).toContain('45,50')
  })

  it('esporta una singola sezione in CSV pulito con BOM', async () => {
    const data = createTestData()
    const res = exportSectionToCsv('income', data, { year: 2026, locale: 'it' })

    expect(res.filename).toBe('pocketly-entrate-2026.csv')
    const rawBytes = new Uint8Array(await res.blob.arrayBuffer())
    expect(rawBytes[0]).toBe(0xef)
    expect(rawBytes[1]).toBe(0xbb)
    expect(rawBytes[2]).toBe(0xbf)
    const text = await res.blob.text()
    expect(text).toContain('Stipendio')
    expect(text).toContain('1800,00')
  })

  it('esegue executeExport con i diversi formati', async () => {
    const data = createTestData()
    const rXlsx = await executeExport('xlsx', data, { year: 2026 })
    expect(rXlsx.filename.endsWith('.xlsx')).toBe(true)

    const rZip = await executeExport('zip', data, { year: 2026 })
    expect(rZip.filename.endsWith('.zip')).toBe(true)

    const rOne = await executeExport('onetime', data, { year: 2026 })
    expect(rOne.filename.endsWith('.csv')).toBe(true)
  })
})
