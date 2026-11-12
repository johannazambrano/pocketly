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
