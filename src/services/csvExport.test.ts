import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/models'
import { createEmptyData } from '@/domain/defaults'
import { generateCsv } from './csvExport'

function createSampleData(): FinanceData {
  const d = createEmptyData()
  d.categories.push({ id: 'c1', name: 'Alimentari', color: '#ff0000' })
  d.paymentMethods.push({ id: 'p1', name: 'Carta "Blu"', color: '#0000ff' }) // Contiene virgolette
  d.tags.push({ id: 't1', name: 'Vacanza;2026', color: '#00ff00' }) // Contiene punto e virgola
  d.oneTimeExpenses.push(
    {
      id: 'o1',
      name: 'Cena fuori',
      amount: 4550,
      date: '2026-06-15',
      categoryId: 'c1',
      paymentMethodId: 'p1',
      notes: 'Pizza e dolce\ncon amici', // Contiene newline
      tagIds: ['t1'],
    },
    {
      id: 'o2',
      name: 'Spesa vecchia',
      amount: 1000,
      date: '2025-11-20',
      categoryId: 'c1',
      paymentMethodId: 'p1',
      notes: '',
      tagIds: [],
    },
  )
  d.recurringExpenses.push({
    id: 'r1',
    name: 'Palestra',
    amount: 5000,
    frequency: 'monthly',
    startDate: '2026-06-01',
    endDate: '2026-07-31',
    categoryId: 'c1',
    paymentMethodId: 'p1',
  })
  d.incomes.push({
    id: 'i1',
    name: 'Stipendio',
    amount: 200000,
    date: '2026-06-27',
    categoryId: 'c1',
    paymentMethodId: 'p1',
    notes: 'Mese corrente',
    tagIds: [],
  })
  d.loans.push({
    id: 'l1',
    name: 'Prestito Luigi',
    amount: 10000,
    type: 'given',
    date: '2026-05-10',
    notes: 'Per emergenza',
    repayments: [{ id: 'rep1', amount: 5000, date: '2026-06-10' }],
  })
  return d
}

describe('generateCsv', () => {
  const data = createSampleData()

  it('inizia con il BOM UTF-8 (\\uFEFF) per la compatibilità con Excel', () => {
    const csv = generateCsv(data, { locale: 'it' })
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })

  it('in lingua italiana usa il punto e virgola come separatore e la virgola decimale', () => {
    const csv = generateCsv(data, { locale: 'it', year: 2026 })
    const lines = csv.replace('\uFEFF', '').split('\r\n')
    // Header
    expect(lines[0]).toBe('Data;Tipo;Nome;Importo (€);Categoria;Metodo di Pagamento;Tag;Note')
    // Verifica importo in centesimi convertito con virgola (45.50 -> 45,50)
    expect(lines.some((l) => l.includes('45,50'))).toBe(true)
  })

  it('in lingua inglese usa la virgola come separatore e il punto decimale', () => {
    const csv = generateCsv(data, { locale: 'en', year: 2026 })
    const lines = csv.replace('\uFEFF', '').split('\r\n')
    // Header
    expect(lines[0]).toBe('Date,Type,Name,Amount (€),Category,Payment Method,Tags,Notes')
    // Verifica importo in centesimi convertito con punto (45.50 -> 45.50)
    expect(lines.some((l) => l.includes('45.50'))).toBe(true)
  })

  it('esegue correttamente l’escape di virgolette, newline e caratteri delimitatori', () => {
    const csv = generateCsv(data, { locale: 'it', year: 2026 })
    // La riga con la carta con virgolette ('Carta "Blu"') deve contenere '""Blu""'
    expect(csv).toContain('""Blu""')
    // Il tag con punto e virgola ('Vacanza;2026') deve essere racchiuso tra virgolette
    expect(csv).toContain('"Vacanza;2026"')
    // La nota con a capo deve essere racchiusa tra virgolette
    expect(csv).toContain('"Pizza e dolce\ncon amici"')
  })

  it('filtra per anno specificato', () => {
    const csv2026 = generateCsv(data, { locale: 'it', year: 2026 })
    expect(csv2026).toContain('Cena fuori')
    expect(csv2026).not.toContain('Spesa vecchia') // 2025

    const csvAll = generateCsv(data, { locale: 'it', year: 'all' })
    expect(csvAll).toContain('Cena fuori')
    expect(csvAll).toContain('Spesa vecchia')
  })

  it('espande le occorrenze delle spese ricorrenti con la loro data di addebito', () => {
    const csv = generateCsv(data, { locale: 'it', year: 2026 })
    // Palestra attiva a giugno e luglio 2026
    expect(csv).toContain('2026-06-01;Spesa ricorrente;Palestra;50,00')
    expect(csv).toContain('2026-07-01;Spesa ricorrente;Palestra;50,00')
    // Non attiva ad agosto 2026
    expect(csv).not.toContain('2026-08-01;Spesa ricorrente;Palestra;50,00')
  })

  it('include entrate, prestiti e rimborsi', () => {
    const csv = generateCsv(data, { locale: 'it', year: 2026 })
    expect(csv).toContain('2026-06-27;Entrata;Stipendio;2000,00')
    expect(csv).toContain('2026-05-10;Prestito concesso;Prestito Luigi;100,00')
    expect(csv).toContain('2026-06-10;Rimborso prestito;Prestito Luigi;50,00')
  })

  it('include le spese ricorrenti negli anni intermedi tra min e max in esportazione all years', () => {
    const multiYearData = createEmptyData()
    multiYearData.categories.push({ id: 'c1', name: 'Varie', color: '#000' })
    multiYearData.paymentMethods.push({ id: 'p1', name: 'Contanti', color: '#000' })
    // Spesa nel 2022
    multiYearData.oneTimeExpenses.push({
      id: 'o-2022',
      name: 'Spesa 2022',
      amount: 1000,
      date: '2022-01-15',
      categoryId: 'c1',
      paymentMethodId: 'p1',
      notes: '',
    })
    // Spesa nel 2024 (nessuna nel 2023)
    multiYearData.oneTimeExpenses.push({
      id: 'o-2024',
      name: 'Spesa 2024',
      amount: 1000,
      date: '2024-01-15',
      categoryId: 'c1',
      paymentMethodId: 'p1',
      notes: '',
    })
    // Ricorrenza attiva nel 2022, 2023, 2024
    multiYearData.recurringExpenses.push({
      id: 'r-sub',
      name: 'Abbonamento continuo',
      amount: 1500,
      frequency: 'annual',
      startDate: '2022-03-01',
      endDate: null,
      categoryId: 'c1',
      paymentMethodId: 'p1',
    })

    const csvAll = generateCsv(multiYearData, { locale: 'it', year: 'all' })
    expect(csvAll).toContain('2022-03-01;Spesa ricorrente;Abbonamento continuo;15,00')
    expect(csvAll).toContain('2023-03-01;Spesa ricorrente;Abbonamento continuo;15,00')
    expect(csvAll).toContain('2024-03-01;Spesa ricorrente;Abbonamento continuo;15,00')
  })
})
