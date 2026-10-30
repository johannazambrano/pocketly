import { describe, expect, it } from 'vitest'
import { BackupFormatError, parseBackup } from './migration'

/** Formato salvato dal prototipo index.html (`finances_tracker_multiyr`). */
const prototypeBackup = {
  currentYear: '2026',
  categories: [
    { name: 'Financial', color: '#10b981' },
    { name: "Sant'Anna", color: '#ff0000' },
  ],
  paymentMethods: ['Bank Transfer', 'PayPal'],
  years: {
    '2026': {
      oneTimeExpenses: [
        { id: 1, name: 'luce', amount: 63.1, category: "Sant'Anna", date: '2026-10-01', month: 'October', payment: 'Bank Transfer', notes: '' },
        { id: 2, name: 'orfana', amount: 10, category: 'Categoria eliminata', date: '2026-10-02', payment: 'PayPal' },
      ],
      recurringExpenses: [
        { id: 3, name: 'mutuo', amount: 502, category: 'Financial', frequency: 'Monthly', payment: 'Bank Transfer' },
        { id: 4, name: 'bollo', amount: 120, category: 'Financial', frequency: 'Semi-annual', payment: 'Bank Transfer' },
      ],
      incomes: [{ id: 5, name: 'stipendio', amount: 2000, category: 'Financial', date: '2026-10-27', payment: 'Bank Transfer' }],
      simulations: [{ id: 6, name: 'TV', amount: 499.99, monthIndex: 11, monthName: 'December' }],
      loans: [{ id: 7, name: 'Mario', amount: 300, type: 'given', date: '2026-09-01', notes: '', repayments: [{ id: 8, amount: 100, date: '2026-09-15' }] }],
    },
  },
}

describe('parseBackup – prototipo', () => {
  const data = parseBackup(prototypeBackup)
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name

  it('converte gli importi in centesimi', () => {
    expect(data.oneTimeExpenses[0]!.amount).toBe(6310)
    expect(data.simulations[0]!.amount).toBe(49999)
    expect(data.loans[0]!.repayments[0]!.amount).toBe(10000)
  })

  it('collega categorie e metodi per id, mantenendo i colori', () => {
    expect(catName(data.oneTimeExpenses[0]!.categoryId)).toBe("Sant'Anna")
    expect(data.categories.find((c) => c.name === "Sant'Anna")!.color).toBe('#ff0000')
    expect(data.paymentMethods.map((p) => p.name)).toEqual(['Bank Transfer', 'PayPal'])
  })

  it('non distingue maiuscole e minuscole nei nomi', () => {
    const d = parseBackup({
      paymentMethods: [{ name: 'Paypal', color: '#221675' }],
      years: { '2026': { oneTimeExpenses: [{ id: 1, name: 'x', amount: 1, category: 'A', date: '2026-01-01', payment: 'PayPal' }] } },
    })
    expect(d.paymentMethods.map((p) => p.name)).toEqual(['Paypal'])
    expect(d.oneTimeExpenses[0]!.paymentMethodId).toBe(d.paymentMethods[0]!.id)
  })

  it('ricrea le categorie citate ma non più esistenti', () => {
    expect(catName(data.oneTimeExpenses[1]!.categoryId)).toBe('Categoria eliminata')
  })

  it('trasforma le ricorrenze con data di inizio e frequenza corretta', () => {
    expect(data.recurringExpenses.map((r) => [r.name, r.frequency, r.startDate])).toEqual([
      ['mutuo', 'monthly', '2026-01-01'],
      ['bollo', 'semiannual', '2026-01-01'],
    ])
  })

  it('porta simulazioni e prestiti', () => {
    expect(data.simulations[0]).toMatchObject({ year: 2026, month: 11 })
    expect(data.loans[0]).toMatchObject({ name: 'Mario', type: 'given', amount: 30000 })
  })
})

describe('parseBackup – schema v2', () => {
  it('è idempotente su un backup esportato', () => {
    const v2 = parseBackup(prototypeBackup)
    expect(parseBackup(JSON.parse(JSON.stringify(v2)))).toEqual(v2)
  })

  it('scarta le voci malformate', () => {
    const data = parseBackup({
      schemaVersion: 2,
      oneTimeExpenses: [
        { id: 'a', name: 'ok', amount: 100, date: '2026-01-01', categoryId: 'c', paymentMethodId: 'p' },
        { id: 'b', name: 'importo decimale', amount: 1.5, date: '2026-01-01' },
        { id: 'c', name: 'data errata', amount: 100, date: '2026-02-30' },
      ],
    })
    expect(data.oneTimeExpenses.map((e) => e.id)).toEqual(['a'])
  })

  it('le impostazioni di previsione hanno un valore predefinito e si conservano', () => {
    expect(parseBackup({ schemaVersion: 2 }).forecast).toEqual({ estimateIncome: false, incomeCategoryIds: [] })
    expect(parseBackup(prototypeBackup).forecast).toEqual({ estimateIncome: false, incomeCategoryIds: [] })
    const saved = parseBackup({ schemaVersion: 2, forecast: { estimateIncome: true, incomeCategoryIds: ['a', 'b'] } })
    expect(saved.forecast).toEqual({ estimateIncome: true, incomeCategoryIds: ['a', 'b'] })
    expect(parseBackup(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })

  it('ignora impostazioni di previsione malformate', () => {
    const data = parseBackup({ schemaVersion: 2, forecast: { estimateIncome: 'sì', incomeCategoryIds: ['a', 5, null] } })
    expect(data.forecast).toEqual({ estimateIncome: false, incomeCategoryIds: ['a'] })
    expect(parseBackup({ schemaVersion: 2, forecast: 'boh' }).forecast.estimateIncome).toBe(false)
  })

  it('il budget è vuoto nei vecchi backup e si conserva in quelli nuovi', () => {
    expect(parseBackup({ schemaVersion: 2 }).budget).toEqual({ limits: {} })
    expect(parseBackup(prototypeBackup).budget).toEqual({ limits: {} })
    const raw = {
      schemaVersion: 2,
      categories: [{ id: 'c1', name: 'Cibo', color: '#112233' }],
      budget: { limits: { c1: 30000 } },
    }
    const saved = parseBackup(raw)
    expect(saved.budget.limits).toEqual({ c1: 30000 })
    expect(parseBackup(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })

  it('scarta limiti di budget non validi o di categorie che non esistono', () => {
    const data = parseBackup({
      schemaVersion: 2,
      categories: [
        { id: 'a', name: 'A', color: '#112233' },
        { id: 'b', name: 'B', color: '#112233' },
        { id: 'c', name: 'C', color: '#112233' },
        { id: 'd', name: 'D', color: '#112233' },
      ],
      budget: { limits: { a: 1000, b: -5, c: 'tanto', d: 12.5, gone: 2000 } },
    })
    expect(data.budget.limits).toEqual({ a: 1000 })
    expect(parseBackup({ schemaVersion: 2, budget: 'boh' }).budget).toEqual({ limits: {} })
  })

  it('i conti mancano nei vecchi backup e si conservano in quelli nuovi', () => {
    expect(parseBackup({ schemaVersion: 2 }).accounts).toEqual([])
    expect(parseBackup(prototypeBackup).accounts).toEqual([])
    const saved = parseBackup({
      schemaVersion: 2,
      paymentMethods: [
        { id: 'p1', name: 'Bancomat', color: '#112233' },
        { id: 'p2', name: 'Contanti', color: '#445566' },
      ],
      accounts: [
        { id: 'a1', name: 'Conto', openingAmount: 26697, openingDate: '2026-10-30', paymentMethodIds: ['p1', 'sparito'] },
        { id: 'a2', name: 'Contanti', openingAmount: -500, openingDate: '2026-10-01', paymentMethodIds: ['p1', 'p2'] },
        { id: 'a3', name: 'Senza importo', openingDate: '2026-10-01', paymentMethodIds: [] },
        { id: 'a4', name: '', openingAmount: 0, openingDate: '2026-10-01', paymentMethodIds: [] },
      ],
    })
    expect(saved.accounts).toEqual([
      { id: 'a1', name: 'Conto', openingAmount: 26697, openingDate: '2026-10-30', paymentMethodIds: ['p1'] },
      { id: 'a2', name: 'Contanti', openingAmount: -500, openingDate: '2026-10-01', paymentMethodIds: ['p2'] },
    ])
    expect(parseBackup(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })

  it('rifiuta formati sconosciuti', () => {
    expect(() => parseBackup({ foo: 1 })).toThrow(BackupFormatError)
    expect(() => parseBackup('ciao')).toThrow(BackupFormatError)
  })
})
