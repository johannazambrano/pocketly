/**
 * Logica della sincronizzazione, senza interfaccia e senza archivio: riceve il server, la chiave di cifratura
 * e lo stato, e restituisce il nuovo stato. Così si può provare con un server finto.
 *
 * Il server conserva solo dati cifrati con un numero di versione. Questo dispositivo ricorda la "base",
 * cioè l'ultima versione sincronizzata: l'unione a tre vie (base, dati locali, dati del server) dice con
 * certezza cosa è cambiato e dove, comprese le cancellazioni.
 */
import { hasUserData } from '@/domain/backupReminder'
import { deepEqual, mergeFinanceData } from '@/domain/merge'
import {
  decryptWithKey,
  deriveBackupKey,
  encryptWithKey,
  type DerivedKey,
  type EncryptedBackup,
} from '@/services/backupCrypto'
import { parseBackup } from '@/services/migration'
import type { FinanceData } from '@/types/models'
import type { SyncApi } from './api'

export interface SyncState {
  /** Ultima versione del server che questo dispositivo conosce. */
  version: number
  /** I dati di quella versione: il punto di partenza comune per l'unione. */
  base: FinanceData
  lastSyncedAt: string
}

/** Un altro dispositivo ha scritto mentre si sceglieva: bisogna ricominciare il collegamento. */
export class SyncConflictError extends Error {
  constructor() {
    super('server changed during setup')
    this.name = 'SyncConflictError'
  }
}

/** Troppi conflitti di fila (altri dispositivi che scrivono di continuo): si riprova più tardi. */
export class SyncBusyError extends Error {
  constructor() {
    super('server keeps changing')
    this.name = 'SyncBusyError'
  }
}

const MAX_ATTEMPTS = 3

const snapshot = (data: FinanceData): FinanceData => JSON.parse(JSON.stringify(data)) as FinanceData

async function decode(payload: EncryptedBackup, key: DerivedKey): Promise<FinanceData> {
  return parseBackup(JSON.parse(await decryptWithKey(payload, key)))
}

const encode = (data: FinanceData, key: DerivedKey) => encryptWithKey(JSON.stringify(data), key)

const stateFor = (version: number, base: FinanceData): SyncState => ({
  version,
  base: snapshot(base),
  lastSyncedAt: new Date().toISOString(),
})

// --- primo collegamento ----------------------------------------------------

export type ConnectResult =
  /** Il server è vuoto: si caricano i dati di questo dispositivo. */
  | { kind: 'empty'; version: number; key: DerivedKey }
  /** Il server ha dati e questo dispositivo no (o sono uguali): si usano quelli del server. */
  | { kind: 'server'; version: number; key: DerivedKey; remote: FinanceData }
  /** Dati da tutte e due le parti: l'utente deve scegliere quali tenere. */
  | { kind: 'choose'; version: number; key: DerivedKey; remote: FinanceData }

/**
 * Controlla chiave del server e password e dice cosa fare. Lancia SyncAuthError con la chiave sbagliata
 * e WrongPasswordError se la password non apre i dati del server.
 */
export async function prepareConnection(api: SyncApi, password: string, local: FinanceData): Promise<ConnectResult> {
  const res = await api.pull(null)
  if (!res.changed) throw new Error('unexpected 304')
  if (!res.payload) return { kind: 'empty', version: res.version, key: await deriveBackupKey(password) }
  const key = await deriveBackupKey(password, res.payload.salt, res.payload.iterations)
  const remote = await decode(res.payload, key)
  const kind = hasUserData(local) && !deepEqual(snapshot(local), remote) ? 'choose' : 'server'
  return { kind, version: res.version, key, remote }
}

/** Usa i dati del server: quelli di questo dispositivo vengono sostituiti (lo fa chi chiama, con `remote`). */
export function useServerData(result: { version: number; remote: FinanceData }): SyncState {
  return stateFor(result.version, result.remote)
}

/** Carica i dati di questo dispositivo sul server, sostituendo quelli presenti. */
export async function useDeviceData(api: SyncApi, result: ConnectResult, local: FinanceData): Promise<SyncState> {
  const data = snapshot(local)
  const res = await api.push(result.version, await encode(data, result.key))
  if (!res.saved) throw new SyncConflictError()
  return stateFor(res.version, data)
}

// --- sincronizzazione ordinaria ---------------------------------------------

export interface SyncContext {
  api: SyncApi
  key: DerivedKey
  state: SyncState
  /** Dati attuali di questo dispositivo, letti al momento: possono cambiare mentre si aspetta il server. */
  getLocal(): FinanceData
  /** Sostituisce i dati di questo dispositivo con quelli uniti. */
  setLocal(data: FinanceData): void
}

/**
 * Un ciclo completo: scarica (se ci sono novità), unisce, invia. In caso di conflitto (un altro dispositivo
 * ha scritto nel frattempo) ricomincia. Restituisce il nuovo stato da salvare.
 */
export async function syncOnce(ctx: SyncContext): Promise<SyncState> {
  const state = ctx.state
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await ctx.api.pull(state.version)
    let toPush: FinanceData
    let baseVersion: number

    if (!res.changed) {
      // Il server non è cambiato: si invia solo se ci sono modifiche locali.
      const local = snapshot(ctx.getLocal())
      if (deepEqual(local, state.base)) return { ...state, lastSyncedAt: new Date().toISOString() }
      toPush = local
      baseVersion = state.version
    } else if (!res.payload) {
      // Server svuotato (es. reinstallato): si ricaricano i dati di questo dispositivo.
      toPush = snapshot(ctx.getLocal())
      baseVersion = res.version
    } else {
      const remote = await decode(res.payload, ctx.key)
      // Unione e scrittura sono sincrone: una modifica fatta mentre si aspettava il server non va persa.
      const merged = mergeFinanceData(state.base, snapshot(ctx.getLocal()), remote)
      if (!deepEqual(merged, snapshot(ctx.getLocal()))) ctx.setLocal(snapshot(merged))
      if (deepEqual(merged, remote)) return stateFor(res.version, remote)
      toPush = merged
      baseVersion = res.version
    }

    const pushed = await ctx.api.push(baseVersion, await encode(toPush, ctx.key))
    if (pushed.saved) return stateFor(pushed.version, toPush)
    // Conflitto: al giro successivo si scaricano i dati nuovi e si unisce di nuovo partendo dalla stessa base.
  }
  throw new SyncBusyError()
}
