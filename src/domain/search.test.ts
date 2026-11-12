import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/models'
import { createEmptyData } from './defaults'
import { searchFinance } from './search'

function createSampleData(): FinanceData {
  const d = createEmptyData()
  d.categories.push(
    { id: 'cat-food', name: 'Alimentari', color: '#ff0000' },
    { id: 'cat-salary', name: 'Stipendio', color: '#00ff00' },
    { id: 'cat-home', name: 'Casa', color: '#0000ff' },
  )
  d.paymentMethods.push(
    { id: 'pm-card', name: 'Carta di credito', color: '#111111' },
    { id: 'pm-bank', name: 'Bonifico', color: '#222222' },
  )
  d.tags.push(
    { id: 'tag-vacation', name: 'Vacanza 2026', color: '#333333' },
    { id: 'tag-gift', name: 'Regalo', color: '#444444' },
  )
  d.oneTimeExpenses.push(
    {
      id: 'o1',
      name: 'Cena ristorante',
      amount: 4500,
      date: '2026-06-15',
      categoryId: 'cat-food',
      paymentMethodId: 'pm-card',
      notes: 'Pizza con amici',
      tagIds: ['tag-vacation'],
    },
    {
      id: 'o2',
      name: 'Spesa supermercato',
      amount: 8200,
      date: '2026-06-20',
      categoryId: 'cat-food',
      paymentMethodId: 'pm-card',
      notes: '',
      tagIds: [],
    },
  )
  d.recurringExpenses.push({
    id: 'r1',
    name: 'Affitto mensile',
    amount: 60000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: null,
    categoryId: 'cat-home',
    paymentMethodId: 'pm-bank',
  })
  d.incomes.push({
    id: 'i1',
    name: 'Stipendio azienda',
    amount: 210000,
    date: '2026-06-27',
    categoryId: 'cat-salary',
    paymentMethodId: 'pm-bank',
    notes: 'Incluso rimborso spese',
    tagIds: ['tag-gift'],
  })
  d.loans.push({
    id: 'l1',
    name: 'Prestito a Marco',
    amount: 15000,
    type: 'given',
    date: '2026-05-10',
    notes: 'Per acquisto bici',
    repayments: [],
  })
  return d
}

describe('searchFinance', () => {
  const data = createSampleData()

  it('restituisce array vuoto se la query è vuota o composta solo da spazi', () => {
    expect(searchFinance(data, '')).toEqual([])
    expect(searchFinance(data, '   ')).toEqual([])
  })

  it('trova voci per nome (case-insensitive)', () => {
    const results = searchFinance(data, 'ristorante')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('o1')
    expect(results[0]?.kind).toBe('onetime')
    expect(results[0]?.year).toBe(2026)
    expect(results[0]?.month).toBe(5) // Giugno = mese 5 (0-indexed)
  })

  it('trova voci per note', () => {
    const results = searchFinance(data, 'pizza')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('o1')

    const loanResults = searchFinance(data, 'bici')
    expect(loanResults).toHaveLength(1)
    expect(loanResults[0]?.id).toBe('l1')
    expect(loanResults[0]?.kind).toBe('loan')
    expect(loanResults[0]?.loanType).toBe('given')
  })

  it('trova voci per nome della categoria', () => {
    const results = searchFinance(data, 'alimentari')
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.id)).toEqual(['o2', 'o1']) // ordinate per data discendente
  })

  it('trova voci per nome del metodo di pagamento', () => {
    const results = searchFinance(data, 'bonifico')
    // Affitto (ricorrente) e Stipendio (entrata)
    expect(results).toHaveLength(2)
    expect(results.some((r) => r.id === 'r1' && r.kind === 'recurring')).toBe(true)
    expect(results.some((r) => r.id === 'i1' && r.kind === 'income')).toBe(true)
  })

  it('trova voci per tag associato', () => {
    const results = searchFinance(data, 'vacanza')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('o1')

    const giftResults = searchFinance(data, 'regalo')
    expect(giftResults).toHaveLength(1)
    expect(giftResults[0]?.id).toBe('i1')
  })

  it('supporta query a più parole (AND)', () => {
    const results = searchFinance(data, 'cena pizza')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('o1')

    const noMatch = searchFinance(data, 'cena supermercato')
    expect(noMatch).toEqual([])
  })

  it('ordina per data decrescente, e le ricorrenze alla fine', () => {
    const results = searchFinance(data, 'a') // trova quasi tutto
    expect(results.length).toBeGreaterThan(1)
    // Le voci con data vengono prima di quelle senza data
    const withDate = results.filter((r) => r.date)
    const withoutDate = results.filter((r) => !r.date)
    expect(results).toEqual([...withDate, ...withoutDate])

    // Verifica che withDate sia ordinato per data decrescente
    for (let i = 0; i < withDate.length - 1; i++) {
      expect(withDate[i]!.date! >= withDate[i + 1]!.date!).toBe(true)
    }
  })

  it('gestisce la ricerca insensibile agli accenti / diacritici', () => {
    // Aggiungiamo una spesa con accento
    const dataWithAccents = createSampleData()
    dataWithAccents.oneTimeExpenses.push({
      id: 'o-caffe',
      name: 'Caffè al bar',
      amount: 130,
      date: '2026-06-25',
      categoryId: 'cat-food',
      paymentMethodId: 'pm-card',
      notes: 'Espresso',
    })

    // Cerca senza accento
    const results = searchFinance(dataWithAccents, 'caffe')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('o-caffe')

    // Cerca con accento
    const resultsWithAccent = searchFinance(dataWithAccents, 'caffè')
    expect(resultsWithAccent).toHaveLength(1)
    expect(resultsWithAccent[0]?.id).toBe('o-caffe')
  })

  it('trova voci per importo (intero, decimale con virgola o punto)', () => {
    // o1 ha importo 4500 (45.00 euro)
    expect(searchFinance(data, '45').some((r) => r.id === 'o1')).toBe(true)
    expect(searchFinance(data, '45,00').some((r) => r.id === 'o1')).toBe(true)
    expect(searchFinance(data, '45.00').some((r) => r.id === 'o1')).toBe(true)

    // Ricerca combinata nome + importo
    const combined = searchFinance(data, 'cena 45')
    expect(combined).toHaveLength(1)
    expect(combined[0]?.id).toBe('o1')
  })

  it('trova voci per data o anno', () => {
    const results2026 = searchFinance(data, '2026-06-15')
    expect(results2026).toHaveLength(1)
    expect(results2026[0]?.id).toBe('o1')
  })

  it('trova prestiti per tipologia e rimborsi associati', () => {
    const dataWithRepayment = createSampleData()
    dataWithRepayment.loans[0]!.repayments.push({
      id: 'rep-1',
      amount: 5000,
      date: '2026-06-01',
    })

    const givenResults = searchFinance(dataWithRepayment, 'prestito concesso')
    expect(givenResults.some((r) => r.id === 'l1')).toBe(true)

    const repResults = searchFinance(dataWithRepayment, '50')
    expect(repResults.some((r) => r.id === 'l1')).toBe(true)
  })

  it('trova salvadanai e obiettivi di risparmio', () => {
    const testData = createSampleData()
    testData.savingsGoals.push({
      id: 'g1',
      name: 'Fondo emergenza estate',
      targetAmount: 250000,
      currentAmount: 50000,
      targetDate: '2026-08-31',
      notes: 'Conto deposito',
    })

    const byName = searchFinance(testData, 'emergenza')
    expect(byName).toHaveLength(1)
    expect(byName[0]?.kind).toBe('goal')
    expect(byName[0]?.id).toBe('g1')
    expect(byName[0]?.amount).toBe(250000)

    const byKeyword = searchFinance(testData, 'salvadanaio')
    expect(byKeyword.some((r) => r.id === 'g1')).toBe(true)

    const byNote = searchFinance(testData, 'deposito')
    expect(byNote.some((r) => r.id === 'g1')).toBe(true)
  })
})
