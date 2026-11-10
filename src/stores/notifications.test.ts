import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationsStore } from './notifications'
import { useFinanceStore } from './finance'
import { useSyncStore } from './sync'
import type { NotificationRule } from '@/types/models'
import * as apiModule from '@/services/notifications/api'
import { bytesToBase64Url } from '@/services/notifications/webpushCrypto'

const inMemoryIdb = new Map<string, unknown>()

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => inMemoryIdb.get(key)),
  set: vi.fn(async (key: string, val: unknown) => {
    inMemoryIdb.set(key, val)
  }),
  del: vi.fn(async (key: string) => {
    inMemoryIdb.delete(key)
  }),
}))

describe('useNotificationsStore', () => {
  let showNotificationMock = vi.fn()
  let mockNotification: any

  beforeEach(() => {
    vi.unstubAllGlobals()
    setActivePinia(createPinia())
    inMemoryIdb.clear()
    vi.restoreAllMocks()

    showNotificationMock = vi.fn()
    mockNotification = Object.assign(
      function (_title: string, _options?: unknown) {
        showNotificationMock(_title, _options)
      },
      {
        permission: 'default',
        requestPermission: vi.fn(async () => 'granted'),
      },
    )

    const mockDoc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
    }

    const mockWin = {
      Notification: mockNotification,
      matchMedia: vi.fn(() => ({ matches: false })),
    }

    vi.stubGlobal('document', mockDoc)
    vi.stubGlobal('window', mockWin)
    vi.stubGlobal('Notification', mockNotification)
  })

  it('inizializza con regole predefinite e id dispositivo univoco se idb è vuoto', async () => {
    const store = useNotificationsStore()
    await store.init()

    expect(store.ready).toBe(true)
    expect(store.enabled).toBe(false)
    expect(store.deviceId).toMatch(/^[0-9a-f-]{36}$/)
    expect(store.defaultRules).toEqual([{ daysBefore: 1, time: '09:00' }])
  })

  it('carica la configurazione salvata in IndexedDB', async () => {
    inMemoryIdb.set('notification-config', {
      deviceId: 'dev-12345',
      enabled: true,
      defaultRules: [{ daysBefore: 3, time: '10:00' }],
      lastScheduleHash: 'hash-abc',
    })

    const store = useNotificationsStore()
    await store.init()

    expect(store.deviceId).toBe('dev-12345')
    expect(store.enabled).toBe(true)
    expect(store.defaultRules).toEqual([{ daysBefore: 3, time: '10:00' }])
    expect(store.lastScheduleHash).toBe('hash-abc')
  })

  it('consente di aggiornare le regole predefinite normalizzandole', async () => {
    const store = useNotificationsStore()
    await store.init()

    const raw: NotificationRule[] = [
      { daysBefore: 0, time: '09:00' },
      { daysBefore: 7, time: '08:00' },
    ]
    await store.setDefaultRules(raw)
    // Devono essere ordinate canonicamente per daysBefore decrescente
    expect(store.defaultRules).toEqual([
      { daysBefore: 7, time: '08:00' },
      { daysBefore: 0, time: '09:00' },
    ])
  })

  it('calcola correttamente la modalità in base a permessi e sincronizzazione', async () => {
    const store = useNotificationsStore()
    const sync = useSyncStore()
    await sync.init()
    await store.init()

    expect(store.mode).toBe('disabled')

    // Attivazione con permesso concesso
    await store.enable()
    expect(store.enabled).toBe(true)
    expect(store.mode).toBe('local') // Senza sync attiva, modalità locale

    // Se la sincronizzazione viene collegata -> modalità push
    inMemoryIdb.set('sync-config', {
      serverKey: 'test-key',
      key: {} as any,
      state: { version: 1, base: null, snapshot: {} as any },
    })
    await sync.init()
    expect(sync.enabled).toBe(true)
    expect(store.mode).toBe('push')
  })

  it('rifiuta l’attivazione se i permessi vengono negati', async () => {
    mockNotification.permission = 'default'
    mockNotification.requestPermission = vi.fn(async () => 'denied')

    const store = useNotificationsStore()
    await store.init()

    const ok = await store.enable()
    expect(ok).toBe(false)
    expect(store.enabled).toBe(false)
    expect(store.permission).toBe('denied')
  })

  it('disattiva correttamente le notifiche', async () => {
    mockNotification.permission = 'default'
    mockNotification.requestPermission = vi.fn(async () => 'granted')

    const store = useNotificationsStore()
    await store.init()
    await store.enable()
    expect(store.enabled).toBe(true)

    await store.disable()
    expect(store.enabled).toBe(false)
    expect(store.lastScheduleHash).toBeNull()
  })

  it('rileva promemoria locali dovuti e li segna come mostrati in IndexedDB', async () => {
    const finance = useFinanceStore()
    await finance.init('it')

    // Aggiunge una spesa ricorrente con scadenza per cui il promemoria è già maturato
    const now = new Date()
    // Data di oggi in formato ISO
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const todayIso = `${y}-${m}-${d}`

    finance.saveRecurring({
      name: 'Internet Fibra',
      amount: 2999,
      frequency: 'monthly',
      startDate: todayIso,
      endDate: null,
      categoryId: finance.data.categories[0]!.id,
      paymentMethodId: finance.data.paymentMethods[0]!.id,
      notifications: [{ daysBefore: 0, time: '00:00' }], // Promemoria a mezzanotte del giorno stesso -> già scattato
    })
    vi.stubGlobal('Notification', Object.assign(
      function (_title: string, _options?: unknown) {
        showNotificationMock(_title, _options)
      },
      {
        permission: 'granted',
        requestPermission: vi.fn(async () => 'granted'),
      },
    ))

    const store = useNotificationsStore()
    await store.init()
    await store.enable()

    await store.checkLocalReminders()

    const shown = (inMemoryIdb.get('notifications-shown') as Record<string, number>) || {}
    const expectedId = `${finance.data.recurringExpenses[0]!.id}:${todayIso}:0:00:00`
    expect(shown[expectedId]).toBeDefined()

    // Se invocato una seconda volta, il promemoria è già in shown e non viene rimostrato
    showNotificationMock.mockClear()
    await store.checkLocalReminders()
    expect(showNotificationMock).not.toHaveBeenCalled()
  })

  it('sincronizza la pianificazione push sul server per i dispositivi remoti anche se locale non è attivo', async () => {
    const finance = useFinanceStore()
    await finance.init('it')

    const futureDue = '2030-05-15'
    finance.saveRecurring({
      name: 'Assicurazione Auto',
      amount: 45000,
      frequency: 'annual',
      startDate: futureDue,
      endDate: null,
      categoryId: finance.data.categories[0]!.id,
      paymentMethodId: finance.data.paymentMethods[0]!.id,
      notifications: [{ daysBefore: 7, time: '09:00' }],
    })

    const sync = useSyncStore()
    inMemoryIdb.set('sync-config', {
      serverKey: 'test-sync-key-which-is-long-enough',
      key: {} as any,
      state: { version: 1, base: null, snapshot: {} as any },
    })
    await sync.init()

    const uaKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const uaPubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeyPair.publicKey))
    const authBytes = crypto.getRandomValues(new Uint8Array(16))
    const p256dh = bytesToBase64Url(uaPubBytes)
    const auth = bytesToBase64Url(authBytes)

    const putScheduleMock = vi.fn(async () => ({ scheduled: 1 }))
    vi.spyOn(apiModule, 'createPushApi').mockReturnValue({
      getConfig: vi.fn(async () => ({
        vapidPublicKey: p256dh,
        devices: [
          {
            deviceId: 'remote-phone-id',
            p256dh,
            auth,
          },
        ],
      })),
      putSubscription: vi.fn(),
      deleteSubscription: vi.fn(),
      putSchedule: putScheduleMock,
      sendTest: vi.fn(),
    })

    const store = useNotificationsStore()
    await store.init()
    expect(store.enabled).toBe(false) // Notifiche locali non abilitate su questo PC

    await store.syncPushSchedule(true)
    // Nonostante enabled sia false su questo dispositivo, ha inviato la pianificazione cifrata per il telefono remoto
    expect(putScheduleMock).toHaveBeenCalledTimes(1)
    expect(store.lastScheduleHash).toBeTruthy()
  })

  it('segnala errore se sendTest fallisce sul server push', async () => {
    mockNotification.permission = 'granted'
    const sync = useSyncStore()
    inMemoryIdb.set('sync-config', {
      serverKey: 'test-sync-key-which-is-long-enough',
      key: {} as any,
      state: { version: 1, base: null, snapshot: {} as any },
    })
    await sync.init()

    const uaKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const uaPubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeyPair.publicKey))
    const authBytes = crypto.getRandomValues(new Uint8Array(16))
    const p256dh = bytesToBase64Url(uaPubBytes)
    const auth = bytesToBase64Url(authBytes)

    vi.spyOn(apiModule, 'createPushApi').mockReturnValue({
      getConfig: vi.fn(async () => ({
        vapidPublicKey: p256dh,
        devices: [
          {
            deviceId: 'test-device-id',
            p256dh,
            auth,
          },
        ],
      })),
      putSubscription: vi.fn(),
      deleteSubscription: vi.fn(),
      putSchedule: vi.fn(),
      sendTest: vi.fn(async () => ({ status: 410 })), // 410 Gone dal push gateway
    })

    const store = useNotificationsStore()
    await store.init()
    store.deviceId = 'test-device-id'

    const success = await store.sendTestNotification()
    expect(success).toBe(false)
  })

  /**
   * Con la push attiva il promemoria locale è un ripiego: aspetta 10 minuti, poi compare solo se la push non è arrivata.
   * L'orologio è fermo alle 12:00 di un giorno fisso, così l'ora del promemoria decide se il margine è passato.
   */
  async function setupPushActive(time: string) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 10, 12, 0, 0))
    const finance = useFinanceStore()
    await finance.init('it')

    finance.saveRecurring({
      name: 'Internet Casa',
      amount: 2999,
      frequency: 'monthly',
      startDate: '2026-11-10',
      endDate: null,
      categoryId: finance.data.categories[0]!.id,
      paymentMethodId: finance.data.paymentMethods[0]!.id,
      notifications: [{ daysBefore: 0, time }],
    })

    const store = useNotificationsStore()
    await store.init()
    await store.enable()

    // Simula modalità push attiva
    const sync = useSyncStore()
    inMemoryIdb.set('sync-config', {
      serverKey: 'test-key',
      key: {} as any,
      state: { version: 1, base: null, snapshot: {} as any },
    })
    await sync.init()
    store.pushSubscribed = true

    // Simula supporto ServiceWorker e PushManager
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn(async () => null),
      },
    })
    const win = window as any
    win.PushManager = class {}

    expect(store.isPushActive).toBe(true)
    // enable() controlla subito i promemoria in modalità locale (la push non era ancora attiva): si riparte da zero.
    inMemoryIdb.delete('notifications-shown')
    showNotificationMock.mockClear()
    const reminderId = `${finance.data.recurringExpenses[0]!.id}:2026-11-10:0:${time}`
    return { store, reminderId }
  }

  it('con la push attiva lascia al server 10 minuti prima del promemoria locale', async () => {
    try {
      const { store, reminderId } = await setupPushActive('11:55')
      await store.checkLocalReminders()
      const shown = (inMemoryIdb.get('notifications-shown') as Record<string, number> | undefined) ?? {}
      expect(shown[reminderId]).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('con la push attiva mostra il promemoria locale se la push non è arrivata', async () => {
    try {
      const { store, reminderId } = await setupPushActive('11:30')
      await store.checkLocalReminders()
      // Il promemoria risulta mostrato dall'app: la mappa lo registra solo quando la notifica è andata a buon fine.
      const shown = (inMemoryIdb.get('notifications-shown') as Record<string, number> | undefined) ?? {}
      expect(shown[reminderId]).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('con la push attiva non ripete un promemoria già mostrato dalla push', async () => {
    try {
      const { store, reminderId } = await setupPushActive('11:30')
      // La push l'ha già mostrato (il push-worker scrive la stessa mappa): l'app non lo ripete.
      inMemoryIdb.set('notifications-shown', { [reminderId]: 1 })
      await store.checkLocalReminders()
      const shown = inMemoryIdb.get('notifications-shown') as Record<string, number>
      expect(shown[reminderId]).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('accoda richieste concorrenti di syncPushSchedule con il flag syncAgain', async () => {
    const sync = useSyncStore()
    inMemoryIdb.set('sync-config', {
      serverKey: 'test-sync-key-which-is-long-enough',
      key: {} as any,
      state: { version: 1, base: null, snapshot: {} as any },
    })
    await sync.init()

    let callCount = 0
    const putScheduleMock = vi.fn(async () => {
      callCount++
      // Ritardo artificiale per simulare una chiamata in corso
      await new Promise((r) => setTimeout(r, 50))
      return { scheduled: 1 }
    })

    vi.spyOn(apiModule, 'createPushApi').mockReturnValue({
      getConfig: vi.fn(async () => ({
        vapidPublicKey: 'test-key',
        devices: [{ deviceId: 'dev-1', p256dh: 'p1', auth: 'a1' }],
      })),
      putSubscription: vi.fn(),
      deleteSubscription: vi.fn(),
      putSchedule: putScheduleMock,
      sendTest: vi.fn(),
    })

    const store = useNotificationsStore()
    await store.init()

    // Lancia due chiamate in parallelo con force: true
    const p1 = store.syncPushSchedule(true)
    const p2 = store.syncPushSchedule(true)
    await Promise.all([p1, p2])

    // Entrambe sono state completate senza errori e putSchedule è stato eseguito
    expect(putScheduleMock).toHaveBeenCalled()
  })

  it('include le credenziali crittografiche nell hash della pianificazione', async () => {
    const finance = useFinanceStore()
    await finance.init('it')

    const sync = useSyncStore()
    inMemoryIdb.set('sync-config', {
      serverKey: 'test-sync-key-which-is-long-enough',
      key: {} as any,
      state: { version: 1, base: null, snapshot: {} as any },
    })
    await sync.init()

    let deviceP256dh = 'initial-p256dh'
    const putScheduleMock = vi.fn(async () => ({ scheduled: 1 }))
    vi.spyOn(apiModule, 'createPushApi').mockImplementation(() => ({
      getConfig: vi.fn(async () => ({
        vapidPublicKey: 'test-key',
        devices: [{ deviceId: 'dev-1', p256dh: deviceP256dh, auth: 'a1' }],
      })),
      putSubscription: vi.fn(),
      deleteSubscription: vi.fn(),
      putSchedule: putScheduleMock,
      sendTest: vi.fn(),
    }))

    const store = useNotificationsStore()
    await store.init()

    // Primo invio
    await store.syncPushSchedule(false)
    const firstHash = store.lastScheduleHash
    expect(firstHash).toBeTruthy()

    // Se cambiano le credenziali crittografiche del dispositivo sul server (stesso deviceId)
    deviceP256dh = 'rotated-p256dh'
    await store.syncPushSchedule(false)
    const secondHash = store.lastScheduleHash
    expect(secondHash).toBeTruthy()
    expect(secondHash).not.toBe(firstHash)
  })

  it('gestisce con successo lerrore Illegal constructor di new Notification', async () => {
    // Simula Android Chrome dove new Notification() solleva Illegal constructor
    vi.stubGlobal(
      'Notification',
      Object.assign(
        function () {
          throw new TypeError("Failed to construct 'Notification': Illegal constructor.")
        },
        {
          permission: 'granted',
          requestPermission: vi.fn(async () => 'granted'),
        },
      ),
    )

    const store = useNotificationsStore()
    await store.init()

    // sendTestNotification non deve lanciare eccezioni non gestite
    const result = await store.sendTestNotification()
    expect(result).toBe(false)
  })

  it('su Android Chrome usa ServiceWorkerRegistration.showNotification con successo', async () => {
    const swShowNotification = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn(async () => ({
          showNotification: swShowNotification,
        })),
      },
    })
    vi.stubGlobal(
      'Notification',
      Object.assign(
        function () {
          throw new TypeError("Failed to construct 'Notification': Illegal constructor.")
        },
        {
          permission: 'granted',
          requestPermission: vi.fn(async () => 'granted'),
        },
      ),
    )

    const store = useNotificationsStore()
    await store.init()

    const result = await store.sendTestNotification()
    expect(result).toBe(true)
    expect(swShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Pocketly'),
      expect.objectContaining({
        badge: '/pwa-64x64.png',
        icon: '/pwa-192x192.png',
      }),
    )
  })

  it('non marca come mostrato un promemoria locale se la notifica non puo essere visualizzata', async () => {
    const finance = useFinanceStore()
    await finance.init('it')

    const now = new Date()
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    finance.saveRecurring({
      name: 'Internet Casa',
      amount: 2999,
      frequency: 'monthly',
      startDate: todayIso,
      endDate: null,
      categoryId: finance.data.categories[0]!.id,
      paymentMethodId: finance.data.paymentMethods[0]!.id,
      notifications: [{ daysBefore: 0, time: '00:00' }],
    })

    // new Notification lancia errore e nessun service worker attivo
    vi.stubGlobal(
      'Notification',
      Object.assign(
        function () {
          throw new TypeError("Failed to construct 'Notification': Illegal constructor.")
        },
        {
          permission: 'granted',
          requestPermission: vi.fn(async () => 'granted'),
        },
      ),
    )

    const store = useNotificationsStore()
    await store.init()
    store.enabled = true
    store.permission = 'granted'

    await store.checkLocalReminders()
    const shown = (inMemoryIdb.get('notifications-shown') as Record<string, number>) || {}
    // Poiché showNotificationSafely è fallito, non deve marcare come mostrato
    expect(Object.keys(shown).length).toBe(0)
  })
})
