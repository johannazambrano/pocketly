import { describe, expect, it } from 'vitest'
import type { FinanceData, OneTimeExpense } from '@/types/models'
import { deepEqual, mergeFinanceData } from './merge'

function data(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    schemaVersion: 2,
    categories: [
      { id: 'cat-food', name: 'Cibo', color: '#f59e0b' },
      { id: 'cat-home', name: 'Casa', color: '#3b82f6' },
    ],
    paymentMethods: [{ id: 'pm-card', name: 'Carta', color: '#64748b' }],
    tags: [],
    oneTimeExpenses: [],
    recurringExpenses: [],
    incomes: [],
    loans: [],
    simulations: [],
    forecast: { estimateIncome: false, incomeCategoryIds: [] },
    budget: { limits: {} },
    ...overrides,
  }
}

function expense(id: string, overrides: Partial<OneTimeExpense> = {}): OneTimeExpense {
  return { id, name: 'Caffè', amount: 120, date: '2026-11-05', categoryId: 'cat-food', paymentMethodId: 'pm-card', notes: '', ...overrides }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

describe('mergeFinanceData', () => {
  it('senza modifiche da nessuna parte restituisce gli stessi dati', () => {
    const base = data({ oneTimeExpenses: [expense('a')] })
    expect(mergeFinanceData(base, clone(base), clone(base))).toEqual(base)
  })

  it('tiene due voci identiche con ID diversi (due caffè nello stesso giorno)', () => {
    const base = data()
    const local = data({ oneTimeExpenses: [expense('caffe-1')] })
    const remote = data({ oneTimeExpenses: [expense('caffe-2')] })
    const merged = mergeFinanceData(base, local, remote)
    expect(merged.oneTimeExpenses.map((e) => e.id)).toEqual(['caffe-2', 'caffe-1'])
  })

  it('propaga una cancellazione fatta su questo dispositivo', () => {
    const base = data({ oneTimeExpenses: [expense('a'), expense('b')] })
    const local = data({ oneTimeExpenses: [expense('b')] })
    const remote = clone(base)
    expect(mergeFinanceData(base, local, remote).oneTimeExpenses.map((e) => e.id)).toEqual(['b'])
  })

  it('propaga una cancellazione fatta su un altro dispositivo, senza farla ricomparire', () => {
    const base = data({ oneTimeExpenses: [expense('a'), expense('b')] })
    const local = clone(base)
    const remote = data({ oneTimeExpenses: [expense('a')] })
    expect(mergeFinanceData(base, local, remote).oneTimeExpenses.map((e) => e.id)).toEqual(['a'])
  })

  it('tiene la modifica quando l\'altra parte ha cancellato la stessa voce', () => {
    const base = data({ oneTimeExpenses: [expense('a')] })
    const local = data({ oneTimeExpenses: [expense('a', { amount: 150 })] })
    const remote = data()
    expect(mergeFinanceData(base, local, remote).oneTimeExpenses).toEqual([expense('a', { amount: 150 })])
    expect(mergeFinanceData(base, remote, local).oneTimeExpenses).toEqual([expense('a', { amount: 150 })])
  })

  it('unisce modifiche a voci diverse fatte su due dispositivi', () => {
    const base = data({ oneTimeExpenses: [expense('a'), expense('b')] })
    const local = data({ oneTimeExpenses: [expense('a', { amount: 200 }), expense('b')] })
    const remote = data({ oneTimeExpenses: [expense('a'), expense('b', { name: 'Cornetto' })] })
    expect(mergeFinanceData(base, local, remote).oneTimeExpenses).toEqual([
      expense('a', { amount: 200 }),
      expense('b', { name: 'Cornetto' }),
    ])
  })

  it('stessa voce modificata da tutte e due le parti: vince questo dispositivo, senza mescolare i campi', () => {
    const base = data({ oneTimeExpenses: [expense('a')] })
    const local = data({ oneTimeExpenses: [expense('a', { amount: 200 })] })
    const remote = data({ oneTimeExpenses: [expense('a', { name: 'Cornetto' })] })
    expect(mergeFinanceData(base, local, remote).oneTimeExpenses).toEqual([expense('a', { amount: 200 })])
  })

  it('unisce i limiti di budget di categorie diverse impostati su due dispositivi', () => {
    const base = data()
    const local = data({ budget: { limits: { 'cat-food': 30000 } } })
    const remote = data({ budget: { limits: { 'cat-home': 50000 } } })
    expect(mergeFinanceData(base, local, remote).budget.limits).toEqual({ 'cat-food': 30000, 'cat-home': 50000 })
  })

  it('conserva i campi che questa versione dell\'app non conosce', () => {
    const accounts = [{ id: 'acc-1', name: 'Conto', openingAmount: 100000, openingDate: '2026-01-01', paymentMethodIds: ['pm-card'] }]
    const base = data()
    const local = { ...data({ oneTimeExpenses: [expense('a')] }), accounts } as FinanceData
    const remote = { ...data(), accounts: [] } as FinanceData
    const merged = mergeFinanceData(base, local, remote) as FinanceData & { accounts: unknown }
    expect(merged.accounts).toEqual(accounts)
    expect(merged.oneTimeExpenses).toHaveLength(1)
  })

  it('ripristina una categoria cancellata altrove ma ancora usata qui', () => {
    const base = data()
    const local = data({ oneTimeExpenses: [expense('a', { categoryId: 'cat-home' })] })
    const remote = data({ categories: [{ id: 'cat-food', name: 'Cibo', color: '#f59e0b' }] })
    const merged = mergeFinanceData(base, local, remote)
    expect(merged.categories.map((c) => c.id)).toEqual(['cat-food', 'cat-home'])
  })

  it('toglie dalle impostazioni le categorie cancellate e non più usate', () => {
    const base = data({ budget: { limits: { 'cat-home': 50000 } }, forecast: { estimateIncome: true, incomeCategoryIds: ['cat-home'] } })
    const local = clone(base)
    local.categories = local.categories.filter((c) => c.id !== 'cat-home')
    local.budget.limits = {}
    local.forecast.incomeCategoryIds = []
    const remote = clone(base)
    remote.budget.limits = { 'cat-home': 60000, 'cat-food': 10000 }
    remote.forecast.incomeCategoryIds = ['cat-home', 'cat-food']
    const merged = mergeFinanceData(base, local, remote)
    expect(merged.categories.map((c) => c.id)).toEqual(['cat-food'])
    expect(merged.budget.limits).toEqual({ 'cat-food': 10000 })
    expect(merged.forecast.incomeCategoryIds).toEqual(['cat-food'])
  })

  it('unisce le modifiche alle rate di prestiti diversi', () => {
    const loan = (id: string, repayments: { id: string; amount: number; date: string }[] = []) => ({
      id, name: id, amount: 10000, type: 'given' as const, date: '2026-01-01', notes: '', repayments,
    })
    const base = data({ loans: [loan('l1'), loan('l2')] })
    const local = data({ loans: [loan('l1', [{ id: 'r1', amount: 1000, date: '2026-02-01' }]), loan('l2')] })
    const remote = data({ loans: [loan('l1'), loan('l2', [{ id: 'r2', amount: 500, date: '2026-03-01' }])] })
    const merged = mergeFinanceData(base, local, remote)
    expect(merged.loans.map((l) => l.repayments.map((r) => r.id))).toEqual([['r1'], ['r2']])
  })

  it('unisce tag ed elenchi di tag sulle spese creati su dispositivi diversi', () => {
    const base = data({
      tags: [{ id: 't1', name: 'Vacanza', color: '#111111' }],
      oneTimeExpenses: [expense('e1', { tagIds: ['t1'] })],
    })
    const local = data({
      tags: [
        { id: 't1', name: 'Vacanza', color: '#111111' },
        { id: 't2', name: 'Lavoro', color: '#222222' },
      ],
      oneTimeExpenses: [expense('e1', { tagIds: ['t1', 't2'] })],
    })
    const remote = data({
      tags: [
        { id: 't1', name: 'Vacanza', color: '#111111' },
        { id: 't3', name: 'Regali', color: '#333333' },
      ],
      oneTimeExpenses: [expense('e1', { tagIds: ['t1'] }), expense('e2', { tagIds: ['t3'] })],
    })
    const merged = mergeFinanceData(base, local, remote)
    expect(merged.tags.map((t) => t.id).sort()).toEqual(['t1', 't2', 't3'])
    expect(merged.oneTimeExpenses.find((e) => e.id === 'e1')?.tagIds?.sort()).toEqual(['t1', 't2'])
    expect(merged.oneTimeExpenses.find((e) => e.id === 'e2')?.tagIds).toEqual(['t3'])
  })

  it('propaga aggiunta e rimozione dei promemoria sulle spese ricorrenti', () => {
    const rec = (id: string, notifications?: { daysBefore: number; time: string }[]) => ({
      id,
      name: id,
      amount: 1500,
      frequency: 'monthly' as const,
      startDate: '2026-01-15',
      endDate: null,
      categoryId: 'cat-home',
      paymentMethodId: 'pm-card',
      ...(notifications ? { notifications } : {}),
    })
    const base = data({ recurringExpenses: [rec('r1', [{ daysBefore: 1, time: '09:00' }]), rec('r2')] })
    const local = data({ recurringExpenses: [rec('r1'), rec('r2')] }) // r1: rimossi promemoria in locale
    const remote = data({
      recurringExpenses: [
        rec('r1', [{ daysBefore: 1, time: '09:00' }]),
        rec('r2', [{ daysBefore: 3, time: '10:00' }]), // r2: aggiunti promemoria da remoto
      ],
    })
    const merged = mergeFinanceData(base, local, remote)
    expect(merged.recurringExpenses.find((r) => r.id === 'r1')?.notifications).toBeUndefined()
    expect(merged.recurringExpenses.find((r) => r.id === 'r2')?.notifications).toEqual([{ daysBefore: 3, time: '10:00' }])
  })
})

describe('deepEqual', () => {
  it('ignora l\'ordine delle chiavi ma non quello degli elenchi', () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual({ a: undefined }, {})).toBe(false)
  })
})
