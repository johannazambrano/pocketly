/* eslint-disable no-undef */
/**
 * Gestore Web Push importato dal Service Worker di Pocketly.
 * I pacchetti in arrivo sono già decifrati nativamente dal browser (RFC 8291 aes128gcm).
 */

const SHOWN_KEY = 'notifications-shown'

function markReminderShownInIdb(reminderId) {
  if (!reminderId || typeof indexedDB === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    try {
      const openReq = indexedDB.open('keyval-store')
      openReq.onerror = () => resolve()
      openReq.onsuccess = () => {
        const db = openReq.result
        if (!db.objectStoreNames.contains('keyval')) {
          db.close()
          resolve()
          return
        }
        const tx = db.transaction('keyval', 'readwrite')
        const store = tx.objectStore('keyval')
        const getReq = store.get(SHOWN_KEY)
        getReq.onsuccess = () => {
          const map = getReq.result && typeof getReq.result === 'object' ? { ...getReq.result } : {}
          map[reminderId] = Date.now()
          store.put(map, SHOWN_KEY)
        }
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          resolve()
        }
      }
    } catch {
      resolve()
    }
  })
}

self.addEventListener('push', (event) => {
  let payload = {
    id: '',
    title: 'Pocketly',
    body: 'Promemoria spesa ricorrente in scadenza',
    tag: 'pocketly-reminder',
    url: '/ricorrenti',
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      if (parsed && typeof parsed === 'object') {
        payload = { ...payload, ...parsed }
      }
    } catch {
      const text = event.data.text()
      if (text) payload.body = text
    }
  }

  const options = {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/favicon.svg',
    tag: payload.tag || payload.id || 'pocketly-reminder',
    data: { url: payload.url || '/ricorrenti' },
  }

  event.waitUntil(
    Promise.all([
      markReminderShownInIdb(payload.id),
      self.registration.showNotification(payload.title, options),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetPath = (event.notification.data && event.notification.data.url) || '/ricorrenti'
  const fullUrl = new URL(targetPath, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            return client.navigate(fullUrl).then((c) => (c ? c.focus() : undefined))
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl)
      }
      return undefined
    }),
  )
})
