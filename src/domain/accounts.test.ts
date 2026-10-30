import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/models'
import { createEmptyData } from './defaults'
import { accountBalance, accountBalances } from './accounts'

function sample(): FinanceData {
  const d = createEmptyData()
  d.oneTimeExpenses.push(
    { id: 'o1', name: 'Spesa', amount: 2000, date: '2026-10-05', categoryId: 'food', paymentMethodId: 'card', notes: '' },
    { id: 'o2', name: 'Prima del saldo', amount: 9999, date: '2026-09-30', categoryId: 'food', paymentMethodId: 'card', notes: '' },
    { id: 'o3', name: 'Futura', amount: 10000, date: '2026-11-12', categoryId: 'food', paymentMethodId: 'card', notes: '' },
    { id: 'o4', name: 'Caffè', amount: 150, date: '2026-10-06', categoryId: 'food', paymentMethodId: 'cash', notes: '' },
  )
  d.incomes.push(
    { id: 'i1', name: 'Stipendio', amount: 200000, date: '2026-10-09', categoryId: 'salary', paymentMethodId: 'transfer' },
    { id: 'i2', name: 'Regalo', amount: 5000, date: '2026-10-10', categoryId: 'gift', paymentMethodId: 'cash' },
  )
  d.recurringExpenses.push(
    { id: 'r1', name: 'Mutuo', amount: 50000, frequency: 'monthly', startDate: '2026-05-12', endDate: null, categoryId: 'home', paymentMethodId: 'transfer' },
  )
  d.accounts.push(
    { id: 'bank', name: 'Conto', openingAmount: 10000, openingDate: '2026-09-30', paymentMethodIds: ['card', 'transfer'] },
    { id: 'wallet', name: 'Contanti', openingAmount: 3000, openingDate: '2026-09-30', paymentMethodIds: ['cash'] },
  )
  return d
}

describe('accountBalance', () => {
  it('somma ai saldi di partenza solo i movimenti successivi, fino a oggi, dei metodi del conto', () => {
    const d = sample()
    // 100 + 2000 (stipendio) − 20 (spesa) − 500 (mutuo del 12/10); esclusi il 30/09 e il 12/11.
    expect(accountBalance(d, d.accounts[0]!, '2026-10-30')).toBe(10000 + 200000 - 2000 - 50000)
    expect(accountBalance(d, d.accounts[1]!, '2026-10-30')).toBe(3000 + 5000 - 150)
  })

  it('conta le ricorrenze a ogni scadenza, anche negli anni successivi', () => {
    const d = sample()
    expect(accountBalance(d, d.accounts[0]!, '2026-11-11')).toBe(10000 + 200000 - 2000 - 50000)
    expect(accountBalance(d, d.accounts[0]!, '2026-11-12')).toBe(10000 + 200000 - 2000 - 50000 * 2 - 10000)
    // Ottobre 2026 → gennaio 2027: quattro rate.
    expect(accountBalance(d, d.accounts[0]!, '2027-01-31')).toBe(10000 + 200000 - 2000 - 50000 * 4 - 10000)
  })

  it('i movimenti del giorno di partenza sono già nel saldo', () => {
    const d = sample()
    const a = { ...d.accounts[0]!, openingDate: '2026-10-12' }
    expect(accountBalance(d, a, '2026-10-30')).toBe(10000)
  })

  it('con una data di partenza futura vale solo il saldo indicato', () => {
    const d = sample()
    const a = { ...d.accounts[0]!, openingDate: '2026-12-01' }
    expect(accountBalance(d, a, '2026-10-30')).toBe(10000)
  })

  it('restituisce un saldo per ogni conto', () => {
    expect(accountBalances(sample(), '2026-10-30').map((b) => b.name)).toEqual(['Conto', 'Contanti'])
  })
})
