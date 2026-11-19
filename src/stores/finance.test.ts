import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFinanceStore } from './finance'

/** Un archivio finto al posto di IndexedDB: si vede cosa l'app legge e cosa scrive. */
const stored = new Map<string, unknown>()
const writes: string[] = []
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => stored.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    writes.push(key)
    stored.set(key, value)
  }),
}))

describe('avvio con dati salvati che non si leggono', () => {
  beforeEach(() => {
    // I test girano senza browser: all'avvio lo store ascolta solo quando la pagina va in background.
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
    setActivePinia(createPinia())
    stored.clear()
    writes.length = 0
  })

  it('non scrive niente sopra i dati salvati e lo segnala', async () => {
    // Dati di una versione più nuova dell'app: questa non li sa leggere.
    const newer = { schemaVersion: 99, recurringExpenses: [{ id: 'r1' }] }
    stored.set('finance-data', newer)
    const finance = useFinanceStore()
    await finance.init('it')
    expect(finance.loadError).toBe(true)
    expect(finance.ready).toBe(true)
    // Anche cambiando qualcosa in memoria, niente arriva all'archivio.
    finance.data.oneTimeExpenses.push({ id: 'x', name: 'x', amount: 1, date: '2026-11-12', categoryId: 'c', paymentMethodId: 'p', notes: '' })
    await new Promise((r) => setTimeout(r, 400))
    expect(writes).toEqual([])
    expect(stored.get('finance-data')).toBe(newer)
  })

  it('senza dati salvati parte con quelli di serie e li salva, come prima', async () => {
    const finance = useFinanceStore()
    await finance.init('it')
    expect(finance.loadError).toBe(false)
    expect(writes).toEqual(['finance-data'])
  })
})

describe('inserimenti rapidi', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
    setActivePinia(createPinia())
    stored.clear()
    writes.length = 0
  })

  it('crea, riordina, elimina e registra spese variabili in 1-tap solo con importo fisso', async () => {
    const finance = useFinanceStore()
    await finance.init('it')
    const cat1 = finance.data.categories[0]!.id
    const cat2 = finance.data.categories[1]!.id
    const pm1 = finance.data.paymentMethods[0]!.id
    finance.addTag('tags', 'Lavoro')
    const tagId = finance.data.tags[0]!.id

    const caffe = finance.saveQuickExpense({
      name: '  Caffè  ',
      amount: 150,
      categoryId: cat1,
      paymentMethodId: pm1,
      notes: ' bar ',
      tagIds: [tagId],
    })
    const pranzo = finance.saveQuickExpense({
      name: 'Pranzo',
      categoryId: cat2,
      paymentMethodId: pm1,
      notes: '',
      tagIds: [],
    })

    expect(finance.quickExpenses.map((q) => q.name)).toEqual(['Caffè', 'Pranzo'])
    expect('amount' in pranzo).toBe(false)

    // Riordino
    finance.moveQuickExpense(pranzo.id, -1)
    expect(finance.quickExpenses.map((q) => q.id)).toEqual([pranzo.id, caffe.id])

    // Il rapido senza importo non registra direttamente
    expect(finance.triggerQuickExpense(pranzo, '2026-11-13')).toBeNull()

    // Il rapido con importo fisso crea una spesa variabile con data indicata
    const created = finance.triggerQuickExpense(caffe, '2026-11-13')
    expect(created).not.toBeNull()
    expect(created).toMatchObject({
      name: 'Caffè',
      amount: 150,
      date: '2026-11-13',
      categoryId: cat1,
      paymentMethodId: pm1,
      notes: 'bar',
      tagIds: [tagId],
    })
    expect(finance.data.oneTimeExpenses).toHaveLength(1)

    // tagUsage e deleteTag includono gli inserimenti rapidi
    expect(finance.tagUsage('tags', tagId)).toBe(2)
    expect(finance.tagUsage('categories', cat1)).toBe(2)
    finance.deleteTag('categories', cat1, cat2)
    expect(finance.quickExpenses.find((q) => q.id === caffe.id)?.categoryId).toBe(cat2)
    finance.deleteTag('tags', tagId)
    expect(finance.quickExpenses.find((q) => q.id === caffe.id)?.tagIds).toEqual([])

    finance.deleteQuickExpense(caffe.id)
    expect(finance.quickExpenses.map((q) => q.id)).toEqual([pranzo.id])
  })
})
