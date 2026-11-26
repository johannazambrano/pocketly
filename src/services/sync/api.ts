/** Chiamate al server di sincronizzazione (`server/main.py`) attraverso il trasporto comune `services/http.ts`. */
import type { EncryptedBackup } from '@/services/backupCrypto'
import { createHttpClient, HttpUnreachableError } from '@/services/http'

const call = createHttpClient({ baseUrl: '/api' })

export type PullResult = { changed: false } | { changed: true; version: number; payload: EncryptedBackup | null }
export type PushResult = { saved: true; version: number } | { saved: false; version: number }

export interface SyncApi {
  pull(knownVersion: number | null): Promise<PullResult>
  push(baseVersion: number, payload: EncryptedBackup): Promise<PushResult>
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
      if (!res.ok) throw new HttpUnreachableError(`status ${res.status}`)
      const body = (await res.json()) as { version: number; payload: EncryptedBackup | null }
      return { changed: true, version: body.version, payload: body.payload }
    },
    async push(baseVersion, payload) {
      const res = await call('/sync', {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseVersion, payload }),
      })
      if (res.status !== 200 && res.status !== 409) throw new HttpUnreachableError(`status ${res.status}`)
      const body = (await res.json()) as { version: number }
      return { saved: res.status === 200, version: body.version }
    },
  }
}
