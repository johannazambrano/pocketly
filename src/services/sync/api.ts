/** Chiamate al server di sincronizzazione (`server/main.py`), servito da nginx sotto /api/ sullo stesso indirizzo dell'app. */
import type { EncryptedBackup } from '@/services/backupCrypto'

const BASE = '/api'
const TIMEOUT_MS = 15_000

/** Chiave di accesso al server sbagliata. */
export class SyncAuthError extends Error {
  constructor() {
    super('invalid sync key')
    this.name = 'SyncAuthError'
  }
}

/** Troppi tentativi con la chiave sbagliata: il server si è bloccato per un po'. */
export class SyncBlockedError extends Error {
  constructor() {
    super('too many attempts')
    this.name = 'SyncBlockedError'
  }
}

/** Server non raggiungibile o risposta inattesa. */
export class SyncUnreachableError extends Error {
  constructor(reason: string) {
    super(`sync server unreachable: ${reason}`)
    this.name = 'SyncUnreachableError'
  }
}

export type PullResult = { changed: false } | { changed: true; version: number; payload: EncryptedBackup | null }
export type PushResult = { saved: true; version: number } | { saved: false; version: number }

export interface SyncApi {
  pull(knownVersion: number | null): Promise<PullResult>
  push(baseVersion: number, payload: EncryptedBackup): Promise<PushResult>
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(BASE + path, { ...init, signal: ctrl.signal, cache: 'no-store' })
    if (res.status === 401) throw new SyncAuthError()
    if (res.status === 429) throw new SyncBlockedError()
    return res
  } catch (e) {
    if (e instanceof SyncAuthError || e instanceof SyncBlockedError) throw e
    throw new SyncUnreachableError(e instanceof Error ? e.message : String(e))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Il server c'è? Su Vercel /api/health restituisce la pagina dell'app (stato 200), quindi si controlla
 * il contenuto e non solo lo stato.
 */
export async function isSyncServerAvailable(): Promise<boolean> {
  try {
    const res = await call('/health', { method: 'GET' })
    if (!res.ok) return false
    const body = (await res.json()) as { service?: unknown }
    return body.service === 'pocketly-sync'
  } catch {
    return false
  }
}

export function createSyncApi(serverKey: string): SyncApi {
  const auth = { Authorization: `Bearer ${serverKey}` }
  return {
    async pull(knownVersion) {
      const headers: Record<string, string> = { ...auth }
      if (knownVersion !== null) headers['If-None-Match'] = `"${knownVersion}"`
      const res = await call('/sync', { method: 'GET', headers })
      if (res.status === 304) return { changed: false }
      if (!res.ok) throw new SyncUnreachableError(`status ${res.status}`)
      const body = (await res.json()) as { version: number; payload: EncryptedBackup | null }
      return { changed: true, version: body.version, payload: body.payload }
    },
    async push(baseVersion, payload) {
      const res = await call('/sync', {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseVersion, payload }),
      })
      if (res.status !== 200 && res.status !== 409) throw new SyncUnreachableError(`status ${res.status}`)
      const body = (await res.json()) as { version: number }
      return { saved: res.status === 200, version: body.version }
    },
  }
}
