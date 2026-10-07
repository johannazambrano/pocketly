import { get, set } from 'idb-keyval'
import type { FinanceData } from '@/types/models'
import { parseBackup } from './migration'

/**
 * Punto unico di accesso alla persistenza. Oggi i dati restano sul dispositivo
 * (IndexedDB); per aggiungere una sincronizzazione cloud basterà fornire
 * un'altra implementazione di questa interfaccia.
 */
export interface DataStore {
  load(): Promise<FinanceData | null>
  save(data: FinanceData): Promise<void>
}

const DATA_KEY = 'finance-data'
const LEGACY_LOCALSTORAGE_KEYS = ['finances_tracker_multiyr', 'finances_tracker_2026']

function loadLegacy(): FinanceData | null {
  for (const key of LEGACY_LOCALSTORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return parseBackup(JSON.parse(raw))
    } catch {
      // dati legacy illeggibili: si prova la chiave successiva
    }
  }
  return null
}

export const deviceDataStore: DataStore = {
  async load() {
    const stored = await get<unknown>(DATA_KEY)
    if (stored) return parseBackup(stored)
    // Se l'app è servita dallo stesso indirizzo del prototipo, recupera i suoi dati.
    return loadLegacy()
  },
  async save(data) {
    // JSON round-trip: IndexedDB non può clonare i proxy reattivi di Vue.
    await set(DATA_KEY, JSON.parse(JSON.stringify(data)))
  },
}

/**
 * Chiede al browser di non cancellare automaticamente i dati quando lo spazio
 * scarseggia. Senza questa richiesta, i dati di una PWA poco usata possono
 * essere eliminati.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}
