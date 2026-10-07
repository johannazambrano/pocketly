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

  it('rifiuta formati sconosciuti', () => {
    expect(() => parseBackup({ foo: 1 })).toThrow(BackupFormatError)
    expect(() => parseBackup('ciao')).toThrow(BackupFormatError)
  })
})
