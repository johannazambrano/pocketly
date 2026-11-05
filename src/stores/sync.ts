import { del, get, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { CryptoUnavailableError, isCryptoAvailable, WrongPasswordError, type DerivedKey } from '@/services/backupCrypto'
import { createSyncApi, isSyncServerAvailable, SyncAuthError, SyncBlockedError, SyncUnreachableError } from '@/services/sync/api'
import {
  prepareConnection,
  SyncBusyError,
  SyncConflictError,
  syncOnce,
  useDeviceData,
  useServerData,
  type ConnectResult,
  type SyncState,
} from '@/services/sync/engine'
import { useFinanceStore } from '@/stores/finance'
import type { FinanceData } from '@/types/models'

const CONFIG_KEY = 'sync-config'
/** Attesa dopo una modifica prima di inviarla, per raggruppare più modifiche di fila. */
const CHANGE_DELAY_MS = 3000
const PERIODIC_MS = 5 * 60 * 1000

/**
 * Configurazione salvata sul dispositivo, fuori dai dati finanziari (non finisce nei backup).
 * La chiave di cifratura è un CryptoKey non estraibile: la password non viene salvata.
 */
interface SyncConfig {
  serverKey: string
  key: DerivedKey
  state: SyncState
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
/** Cosa è andato storto, per mostrare il messaggio giusto. */
export type SyncProblem = 'serverKey' | 'password' | 'blocked' | 'offline' | 'crypto' | 'conflict' | 'unknown'

function problemOf(e: unknown): SyncProblem {
  if (e instanceof SyncAuthError) return 'serverKey'
  if (e instanceof WrongPasswordError) return 'password'
  if (e instanceof SyncBlockedError) return 'blocked'
  if (e instanceof SyncUnreachableError || e instanceof SyncBusyError) return 'offline'
  if (e instanceof CryptoUnavailableError) return 'crypto'
  if (e instanceof SyncConflictError) return 'conflict'
  return 'unknown'
}

export const useSyncStore = defineStore('sync', () => {
  const finance = useFinanceStore()

  /** Il server di sincronizzazione risponde? `null` finché non si sa (su Vercel non c'è). */
  const available = ref<boolean | null>(null)
  const cryptoAvailable = isCryptoAvailable()
  const config = ref<SyncConfig | null>(null)
  const status = ref<SyncStatus>('idle')
  const problem = ref<SyncProblem | null>(null)
  /** Collegamento in attesa della scelta tra i dati del server e quelli del dispositivo. */
  const pendingChoice = ref<{ serverKey: string; result: ConnectResult & { remote: FinanceData } } | null>(null)

  const enabled = computed(() => !!config.value)
  const lastSyncedAt = computed(() => config.value?.state.lastSyncedAt ?? null)

  async function saveConfig(next: SyncConfig | null) {
    config.value = next
    try {
      if (next) await set(CONFIG_KEY, { ...next, state: JSON.parse(JSON.stringify(next.state)) })
      else await del(CONFIG_KEY)
    } catch (e) {
      console.error('Salvataggio della configurazione di sincronizzazione non riuscito', e)
    }
  }

  // --- sincronizzazione ------------------------------------------------------

  let running: Promise<void> | null = null
  let again = false

  /** Avvia una sincronizzazione; se ce n'è già una in corso, ne fa un'altra subito dopo. */
  function syncNow(): Promise<void> {
    if (!config.value) return Promise.resolve()
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        await runOnce()
      } while (again && config.value)
    })().finally(() => (running = null))
    return running
  }

  async function runOnce() {
    const cfg = config.value
    if (!cfg) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      status.value = 'offline'
      return
    }
    status.value = 'syncing'
    try {
      const state = await syncOnce({
        api: createSyncApi(cfg.serverKey),
        key: cfg.key,
        state: cfg.state,
        getLocal: () => finance.data,
        setLocal: (data) => void finance.applySynced(data),
      })
      // Nel frattempo la sincronizzazione potrebbe essere stata disattivata.
      if (config.value === cfg) await saveConfig({ ...cfg, state })
      status.value = 'synced'
      problem.value = null
    } catch (e) {
      const p = problemOf(e)
      if (p === 'unknown') console.error('Sincronizzazione non riuscita', e)
      problem.value = p
      status.value = p === 'offline' ? 'offline' : 'error'
    }
  }

  let changeTimer: ReturnType<typeof setTimeout> | undefined
  let listening = false

  function startTriggers() {
    if (listening) return
    listening = true
    watch(
      () => finance.data,
      () => {
        if (!config.value) return
        clearTimeout(changeTimer)
        changeTimer = setTimeout(() => void syncNow(), CHANGE_DELAY_MS)
      },
      { deep: true },
    )
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncNow()
    })
    window.addEventListener('online', () => void syncNow())
    setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow()
    }, PERIODIC_MS)
  }

  async function init() {
    try {
      config.value = (await get<SyncConfig>(CONFIG_KEY)) ?? null
    } catch {
      config.value = null
    }
    available.value = await isSyncServerAvailable()
    if (config.value && available.value) {
      startTriggers()
      await syncNow()
    }
  }

  // --- collegamento e scollegamento ------------------------------------------

  async function finishConnect(serverKey: string, key: DerivedKey, state: SyncState) {
    await saveConfig({ serverKey, key, state })
    status.value = 'synced'
    problem.value = null
    startTriggers()
  }

  /**
   * Collega questo dispositivo. Restituisce `choose` se ci sono dati da tutte e due le parti:
   * in quel caso l'utente deve scegliere con `choose()`.
   */
  async function connect(serverKey: string, password: string): Promise<'done' | 'choose'> {
    problem.value = null
    if (!cryptoAvailable) throw new CryptoUnavailableError()
    const api = createSyncApi(serverKey)
    const result = await prepareConnection(api, password, finance.data)
    if (result.kind === 'choose') {
      pendingChoice.value = { serverKey, result }
      return 'choose'
    }
    if (result.kind === 'server') {
      await finance.applySynced(result.remote)
      await finishConnect(serverKey, result.key, useServerData(result))
    } else {
      await finishConnect(serverKey, result.key, await useDeviceData(api, result, finance.data))
    }
    return 'done'
  }

  /** Scelta dopo un collegamento con dati da tutte e due le parti: la fonte scelta sovrascrive l'altra. */
  async function choose(source: 'server' | 'device') {
    const pending = pendingChoice.value
    if (!pending) return
    const { serverKey, result } = pending
    if (source === 'server') {
      await finance.applySynced(result.remote)
      await finishConnect(serverKey, result.key, useServerData(result))
    } else {
      await finishConnect(serverKey, result.key, await useDeviceData(createSyncApi(serverKey), result, finance.data))
    }
    pendingChoice.value = null
  }

  function cancelChoice() {
    pendingChoice.value = null
  }

  /** Scollega questo dispositivo: i dati restano qui e sul server, smette solo di sincronizzare. */
  async function disconnect() {
    clearTimeout(changeTimer)
    await saveConfig(null)
    status.value = 'idle'
    problem.value = null
  }

  return {
    available,
    cryptoAvailable,
    enabled,
    status,
    problem,
    lastSyncedAt,
    pendingChoice,
    serverKey: computed(() => config.value?.serverKey ?? ''),
    init,
    syncNow,
    connect,
    choose,
    cancelChoice,
    disconnect,
    problemOf,
  }
})
