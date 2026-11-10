import { get, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { LOCALES, i18n } from '@/i18n'
import { useFinanceStore } from '@/stores/finance'
import { useSyncStore } from '@/stores/sync'
import type { NotificationRule } from '@/types/models'
import {
  DEFAULT_NOTIFICATION_RULE,
  calculateDueLocalReminders,
  calculateUpcomingReminders,
  formatReminderMessage,
  normalizeNotifications,
} from '@/domain/notifications'
import {
  createPushApi,
  type EncryptedScheduledPushItem,
} from '@/services/notifications/api'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  encryptWebPushPayload,
} from '@/services/notifications/webpushCrypto'
import { formatCents } from '@/utils/money'
import { formatDate } from '@/utils/dates'
import { fingerprint, stableStringify } from '@/utils/hash'
import { newId } from '@/utils/id'

const CONFIG_KEY = 'notification-config'
const SHOWN_KEY = 'notifications-shown'
const SYNC_DEBOUNCE_MS = 2000

export interface NotificationConfig {
  deviceId: string
  enabled: boolean
  defaultRules: NotificationRule[]
  lastScheduleHash?: string | null
}

export const useNotificationsStore = defineStore('notifications', () => {
  const finance = useFinanceStore()
  const sync = useSyncStore()

  const ready = ref(false)
  const enabled = ref(false)
  const permission = ref<NotificationPermission | 'unsupported'>('default')
  const deviceId = ref('')
  const defaultRules = ref<NotificationRule[]>([{ ...DEFAULT_NOTIFICATION_RULE }])
  const lastScheduleHash = ref<string | null>(null)
  const isSyncingSchedule = ref(false)
  const testSending = ref(false)

  const isSupported = computed(() => {
    return typeof window !== 'undefined' && 'Notification' in window
  })

  const isPermissionGranted = computed(() => permission.value === 'granted')

  const isIos = computed(() => {
    if (typeof navigator === 'undefined') return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !Boolean((window as any).MSStream)
  })

  const isStandalone = computed(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Boolean((navigator as any).standalone)
    )
  })

  const iosInstallRequired = computed(() => {
    return isIos.value && !isStandalone.value
  })

  const mode = computed<'push' | 'local' | 'disabled'>(() => {
    if (!enabled.value || permission.value !== 'granted') return 'disabled'
    if (sync.enabled) return 'push'
    return 'local'
  })

  function updatePermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      permission.value = 'unsupported'
      return
    }
    permission.value = Notification.permission
  }

  async function getServiceWorkerRegistration(timeoutMs = 1500): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
    try {
      const existing = await navigator.serviceWorker.getRegistration()
      if (existing) return existing
      return await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ])
    } catch {
      return null
    }
  }

  async function persistConfig() {
    try {
      const config: NotificationConfig = {
        deviceId: deviceId.value,
        enabled: enabled.value,
        defaultRules: defaultRules.value,
        lastScheduleHash: lastScheduleHash.value,
      }
      await set(CONFIG_KEY, JSON.parse(JSON.stringify(config)))
    } catch (e) {
      console.error('Salvataggio configurazione notifiche non riuscito', e)
    }
  }

  async function subscribePush(): Promise<boolean> {
    if (!sync.enabled || !sync.serverKey) return false
    const reg = await getServiceWorkerRegistration()
    if (!reg || !('pushManager' in reg)) return false
    try {
      const api = createPushApi(sync.serverKey)
      const serverConfig = await api.getConfig()
      if (!serverConfig.vapidPublicKey) return false

      let sub = await reg.pushManager.getSubscription()
      const appServerKey = base64UrlToBytes(serverConfig.vapidPublicKey)

      if (sub && sub.options?.applicationServerKey) {
        const existingKey = new Uint8Array(sub.options.applicationServerKey)
        const matches =
          existingKey.length === appServerKey.length &&
          existingKey.every((b, i) => b === appServerKey[i])
        if (!matches) {
          await sub.unsubscribe()
          sub = null
        }
      }

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        })
      }

      const p256dhKey = sub.getKey('p256dh')
      const authKey = sub.getKey('auth')
      if (!p256dhKey || !authKey) return false

      const p256dh = bytesToBase64Url(new Uint8Array(p256dhKey))
      const auth = bytesToBase64Url(new Uint8Array(authKey))

      await api.putSubscription({
        deviceId: deviceId.value,
        endpoint: sub.endpoint,
        p256dh,
        auth,
      })
      return true
    } catch (e) {
      console.warn('Registrazione sottoscrizione push fallita', e)
      return false
    }
  }

  async function syncPushSchedule(force = false): Promise<void> {
    if (!sync.enabled || !sync.serverKey || isSyncingSchedule.value) {
      return
    }
    isSyncingSchedule.value = true
    try {
      const api = createPushApi(sync.serverKey)
      const serverConfig = await api.getConfig()

      // Se questo dispositivo ha le notifiche attive, si assicura di essere registrato
      if (enabled.value && permission.value === 'granted') {
        const hasCurrentDevice = serverConfig.devices.some((d) => d.deviceId === deviceId.value)
        if (!hasCurrentDevice) {
          const subscribed = await subscribePush()
          if (subscribed) {
            const refreshed = await api.getConfig()
            serverConfig.devices = refreshed.devices
          }
        }
      }

      if (!serverConfig.devices.length) return

      const reminders = calculateUpcomingReminders(finance.data.recurringExpenses, new Date(), 60)
      const locale = i18n.global.locale.value
      const intlTag = LOCALES.find((l) => l.code === locale)?.intl ?? locale

      const scheduleSummary = {
        reminders: reminders.map((r) => ({ id: r.id, fireAt: r.fireAt, amount: r.amount, name: r.expenseName })),
        devices: serverConfig.devices.map((d) => d.deviceId).sort(),
        locale,
      }
      const currentHash = fingerprint(stableStringify(scheduleSummary))
      if (!force && currentHash === lastScheduleHash.value) {
        return
      }

      const t = i18n.global.t
      const encryptedItems: EncryptedScheduledPushItem[] = []
      for (const r of reminders) {
        const formattedAmount = formatCents(r.amount, intlTag)
        const formattedDueDate = formatDate(r.dueDate, intlTag)
        const msg = formatReminderMessage(r, t, formattedAmount, formattedDueDate)
        const plaintext = JSON.stringify({
          id: r.id,
          title: msg.title,
          body: msg.body,
          tag: r.id,
          url: '/ricorrenti',
        })

        for (const device of serverConfig.devices) {
          try {
            const payload = await encryptWebPushPayload(plaintext, device.p256dh, device.auth)
            encryptedItems.push({
              id: r.id,
              deviceId: device.deviceId,
              fireAt: r.fireAt,
              payload,
            })
          } catch (e) {
            console.warn(`Errore cifratura Web Push per dispositivo ${device.deviceId}`, e)
          }
        }
      }

      await api.putSchedule(encryptedItems)
      lastScheduleHash.value = currentHash
      await persistConfig()
    } catch (e) {
      console.warn('Sincronizzazione pianificazione push non riuscita', e)
    } finally {
      isSyncingSchedule.value = false
    }
  }

  let syncDebounceTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleSyncDebounced() {
    clearTimeout(syncDebounceTimer)
    syncDebounceTimer = setTimeout(() => {
      void syncPushSchedule()
    }, SYNC_DEBOUNCE_MS)
  }

  watch(
    [
      () => finance.data.recurringExpenses,
      () => finance.today,
      () => sync.enabled,
      () => enabled.value,
      () => i18n.global.locale.value,
    ],
    () => {
      if (sync.enabled) {
        scheduleSyncDebounced()
      }
    },
    { deep: true },
  )

  async function checkLocalReminders(): Promise<void> {
    if (!enabled.value || permission.value !== 'granted') return
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return

    try {
      const due = calculateDueLocalReminders(finance.data.recurringExpenses, new Date(), 24)
      if (!due.length) return

      let shownMap: Record<string, number> = {}
      try {
        shownMap = (await get<Record<string, number>>(SHOWN_KEY)) || {}
      } catch {
        shownMap = {}
      }

      const unshown = due.filter((r) => !shownMap[r.id])
      if (!unshown.length) return

      const locale = i18n.global.locale.value
      const intlTag = LOCALES.find((l) => l.code === locale)?.intl ?? locale
      const t = i18n.global.t

      const swReg = await getServiceWorkerRegistration()

      for (const r of unshown) {
        const formattedAmount = formatCents(r.amount, intlTag)
        const formattedDueDate = formatDate(r.dueDate, intlTag)
        const msg = formatReminderMessage(r, t, formattedAmount, formattedDueDate)

        if (swReg && 'showNotification' in swReg) {
          await swReg.showNotification(msg.title, {
            body: msg.body,
            icon: '/pwa-192x192.png',
            badge: '/favicon.svg',
            tag: r.id,
            data: { url: '/ricorrenti' },
          })
        } else if (typeof Notification !== 'undefined') {
          new Notification(msg.title, {
            body: msg.body,
            icon: '/pwa-192x192.png',
            tag: r.id,
            data: { url: '/ricorrenti' },
          })
        }
        shownMap[r.id] = Date.now()
      }

      const cutoff = Date.now() - 30 * 86_400 * 1000
      for (const [id, ts] of Object.entries(shownMap)) {
        if (ts < cutoff) delete shownMap[id]
      }
      await set(SHOWN_KEY, JSON.parse(JSON.stringify(shownMap)))
    } catch (e) {
      console.warn('Verifica promemoria locali non riuscita', e)
    }
  }

  async function enable(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }

    const result = await Notification.requestPermission()
    permission.value = result
    if (result !== 'granted') {
      return false
    }

    enabled.value = true
    await persistConfig()

    if (sync.enabled) {
      await subscribePush()
      await syncPushSchedule(true)
    }

    await checkLocalReminders()
    return true
  }

  async function disable(): Promise<void> {
    enabled.value = false
    lastScheduleHash.value = null
    await persistConfig()

    const reg = await getServiceWorkerRegistration()
    if (reg && 'pushManager' in reg) {
      try {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
        }
      } catch (e) {
        console.warn('Errore durante unsubscribe Web Push', e)
      }
    }

    if (sync.enabled && sync.serverKey && deviceId.value) {
      try {
        const api = createPushApi(sync.serverKey)
        await api.deleteSubscription(deviceId.value)
      } catch (e) {
        console.warn('Errore rimozione sottoscrizione dal server', e)
      }
    }
  }

  async function sendTestNotification(): Promise<boolean> {
    if (permission.value !== 'granted') return false
    testSending.value = true
    try {
      const t = i18n.global.t
      const title = t('notifications.testTitle')
      const body = t('notifications.testBody')

      if (sync.enabled && sync.serverKey) {
        try {
          if (enabled.value) {
            await subscribePush()
          }
          const api = createPushApi(sync.serverKey)
          const cfg = await api.getConfig()
          const myDev = cfg.devices.find((d) => d.deviceId === deviceId.value)
          if (myDev) {
            const payloadJson = JSON.stringify({
              id: `test-${Date.now()}`,
              title,
              body,
              tag: 'pocketly-test',
              url: '/ricorrenti',
            })
            const encrypted = await encryptWebPushPayload(payloadJson, myDev.p256dh, myDev.auth)
            const res = await api.sendTest(deviceId.value, encrypted)
            if (res.status >= 200 && res.status < 300) {
              return true
            }
            // Push gateway ha rifiutato l'invio (es. endpoint scaduto 410)
            return false
          }
        } catch (serverErr) {
          console.warn('Invio test push via server non riuscito, fallback su notifica locale:', serverErr)
        }
      }

      const reg = await getServiceWorkerRegistration()
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/favicon.svg',
          tag: 'pocketly-test',
          data: { url: '/ricorrenti' },
        })
        return true
      } else if (typeof Notification !== 'undefined') {
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
          tag: 'pocketly-test',
          data: { url: '/ricorrenti' },
        })
        return true
      }
      return false
    } catch (e) {
      console.error('Invio notifica di prova fallito', e)
      return false
    } finally {
      testSending.value = false
    }
  }

  async function setDefaultRules(rules: NotificationRule[]): Promise<void> {
    const norm = normalizeNotifications(rules)
    defaultRules.value = norm.length ? norm : [{ ...DEFAULT_NOTIFICATION_RULE }]
    await persistConfig()
  }

  async function init(): Promise<void> {
    if (ready.value) return
    updatePermission()

    try {
      const stored = await get<NotificationConfig>(CONFIG_KEY)
      if (stored) {
        deviceId.value = stored.deviceId || newId()
        enabled.value = Boolean(stored.enabled)
        const norm = normalizeNotifications(stored.defaultRules)
        defaultRules.value = norm.length ? norm : [{ ...DEFAULT_NOTIFICATION_RULE }]
        lastScheduleHash.value = stored.lastScheduleHash || null
      } else {
        deviceId.value = newId()
        enabled.value = false
        defaultRules.value = [{ ...DEFAULT_NOTIFICATION_RULE }]
        await persistConfig()
      }
    } catch {
      deviceId.value = newId()
      enabled.value = false
      defaultRules.value = [{ ...DEFAULT_NOTIFICATION_RULE }]
    }

    if (permission.value === 'denied' && enabled.value) {
      enabled.value = false
      await persistConfig()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          updatePermission()
          void checkLocalReminders()
          if (sync.enabled) {
            void syncPushSchedule()
          }
        }
      })
    }

    if (typeof window !== 'undefined') {
      setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void checkLocalReminders()
        }
      }, 60_000)
    }

    void checkLocalReminders()
    if (sync.enabled) {
      void syncPushSchedule()
    }

    ready.value = true
  }

  return {
    ready,
    enabled,
    permission,
    deviceId,
    defaultRules,
    lastScheduleHash,
    isSyncingSchedule,
    testSending,
    isSupported,
    isPermissionGranted,
    isIos,
    isStandalone,
    iosInstallRequired,
    mode,
    init,
    enable,
    disable,
    subscribePush,
    syncPushSchedule,
    checkLocalReminders,
    sendTestNotification,
    setDefaultRules,
  }
})
