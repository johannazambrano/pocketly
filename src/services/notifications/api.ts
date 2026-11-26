/**
 * Chiamate agli endpoint `/api/push/*` del server (`server/main.py`).
 * Tutti i payload delle notifiche viaggiano già cifrati secondo RFC 8291 (`aes128gcm`).
 */
import { createHttpClient, HttpUnreachableError } from '@/services/http'

const call = createHttpClient({ baseUrl: '/api/push' })

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

export function createPushApi(serverKey: string): PushApi {
  const authHeader = { Authorization: `Bearer ${serverKey}` }
  const jsonHeaders = { ...authHeader, 'Content-Type': 'application/json' }

  return {
    async getConfig() {
      const res = await call('/config', { method: 'GET', headers: authHeader })
      if (!res.ok) throw new HttpUnreachableError(`status ${res.status}`)
      return (await res.json()) as PushServerConfig
    },

    async putSubscription(sub) {
      const res = await call('/subscription', {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(sub),
      })
      if (!res.ok) throw new HttpUnreachableError(`status ${res.status}`)
    },

    async deleteSubscription(deviceId) {
      const res = await call('/subscription', {
        method: 'DELETE',
        headers: jsonHeaders,
        body: JSON.stringify({ deviceId }),
      })
      if (!res.ok) throw new HttpUnreachableError(`status ${res.status}`)
    },

    async putSchedule(items) {
      const res = await call('/schedule', {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new HttpUnreachableError(`status ${res.status}`)
      return (await res.json()) as { scheduled: number }
    },

    async sendTest(deviceId, payload) {
      const res = await call('/test', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ deviceId, payload }),
      })
      if (!res.ok) throw new HttpUnreachableError(`status ${res.status}`)
      return (await res.json()) as { status: number; reason?: string; service?: string }
    },
  }
}
