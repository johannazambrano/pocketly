/**
 * Chiamate agli endpoint `/api/push/*` del server (`server/main.py`).
 * Tutti i payload delle notifiche viaggiano già cifrati secondo RFC 8291 (`aes128gcm`).
 */
import { SyncAuthError, SyncBlockedError, SyncUnreachableError } from '@/services/sync/api'

const BASE = '/api/push'
const TIMEOUT_MS = 15_000

export interface PushDevicePublicInfo {
  deviceId: string
  p256dh: string
  auth: string
}

export interface PushServerConfig {
  vapidPublicKey: string
  devices: PushDevicePublicInfo[]
}

export interface PushSubscriptionRegistration {
  deviceId: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface EncryptedScheduledPushItem {
  id: string
  deviceId: string
  /** Timestamp UTC in secondi. */
  fireAt: number
  /** Pacchetto RFC 8291 (`aes128gcm`) codificato in base64. */
  payload: string
}

export interface PushApi {
  getConfig(): Promise<PushServerConfig>
  putSubscription(sub: PushSubscriptionRegistration): Promise<void>
  deleteSubscription(deviceId: string): Promise<void>
  putSchedule(items: EncryptedScheduledPushItem[]): Promise<{ scheduled: number }>
  /** `reason` e `service` arrivano solo se il servizio push ha rifiutato l'invio o non era raggiungibile. */
  sendTest(deviceId: string, payload: string): Promise<{ status: number; reason?: string; service?: string }>
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

export function createPushApi(serverKey: string): PushApi {
  const authHeader = { Authorization: `Bearer ${serverKey}` }
  const jsonHeaders = { ...authHeader, 'Content-Type': 'application/json' }

  return {
    async getConfig() {
      const res = await call('/config', { method: 'GET', headers: authHeader })
      if (!res.ok) throw new SyncUnreachableError(`status ${res.status}`)
      return (await res.json()) as PushServerConfig
    },

    async putSubscription(sub) {
      const res = await call('/subscription', {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(sub),
      })
      if (!res.ok) throw new SyncUnreachableError(`status ${res.status}`)
    },

    async deleteSubscription(deviceId) {
      const res = await call('/subscription', {
        method: 'DELETE',
        headers: jsonHeaders,
        body: JSON.stringify({ deviceId }),
      })
      if (!res.ok) throw new SyncUnreachableError(`status ${res.status}`)
    },

    async putSchedule(items) {
      const res = await call('/schedule', {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new SyncUnreachableError(`status ${res.status}`)
      return (await res.json()) as { scheduled: number }
    },

    async sendTest(deviceId, payload) {
      const res = await call('/test', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ deviceId, payload }),
      })
      if (!res.ok) throw new SyncUnreachableError(`status ${res.status}`)
      return (await res.json()) as { status: number; reason?: string; service?: string }
    },
  }
}
