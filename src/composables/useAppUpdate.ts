import { ref } from 'vue'

/**
 * Stato condiviso degli aggiornamenti dell'app (service worker), usato dall'avviso in basso (UpdatePrompt)
 * e da «Verifica aggiornamenti» nelle Impostazioni.
 *
 * Regola sulla ricarica: si ricarica da sola solo la finestra che ha chiesto l'aggiornamento. Le altre finestre
 * aperte (altre schede al PC) mostrano l'avviso e aspettano il tocco, così un modulo con modifiche non salvate
 * non si perde.
 */

/** Una versione nuova è pronta e aspetta il permesso di subentrare. */
export const updateReady = ref(false)
/** La versione nuova è già subentrata (chiesta da un'altra finestra): manca solo la ricarica di questa. */
export const reloadPending = ref(false)

let registration: ServiceWorkerRegistration | null = null
let requestedHere = false
let reloading = false

export type UpdateCheck = 'available' | 'none' | 'offline' | 'error'

/** Chiamata una volta da UpdatePrompt quando il service worker è registrato. */
export function attachRegistration(reg: ServiceWorkerRegistration): void {
  registration = reg
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || (navigator.onLine ?? true)
}

/**
 * Aspetta che il worker scaricato finisca l'installazione. `update()` si risolve appena il file è scaricato,
 * prima che il worker sia pronto: senza questa attesa si direbbe «già aggiornata» quando non è vero.
 */
function waitUntilInstalled(worker: ServiceWorker, timeoutMs = 30_000): Promise<boolean> {
  if (worker.state === 'installed' || worker.state === 'activated') return Promise.resolve(true)
  if (worker.state === 'redundant') return Promise.resolve(false)
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs, false)
    function done(ok: boolean) {
      clearTimeout(timer)
      worker.removeEventListener('statechange', onChange)
      resolve(ok)
    }
    function onChange() {
      if (worker.state === 'installed' || worker.state === 'activated') done(true)
      else if (worker.state === 'redundant') done(false)
    }
    worker.addEventListener('statechange', onChange)
  })
}

/** Cerca una versione nuova e, se c'è, aspetta che sia pronta. Non la applica. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  if (!isOnline()) return 'offline'
  const reg = registration ?? (await navigator.serviceWorker?.getRegistration().catch(() => undefined)) ?? null
  if (!reg) return 'none'
  try {
    if (!reg.waiting) {
      await reg.update()
      if (reg.installing) await waitUntilInstalled(reg.installing)
    }
    // Il primo worker in assoluto (nessuna pagina controllata) non è un aggiornamento.
    if (reg.waiting && navigator.serviceWorker.controller) {
      updateReady.value = true
      return 'available'
    }
    return 'none'
  } catch (error) {
    console.warn('Controllo aggiornamenti non riuscito:', error)
    return isOnline() ? 'error' : 'offline'
  }
}

function reloadOnce(): void {
  if (reloading) return
  reloading = true
  window.location.reload()
}

/** Applica l'aggiornamento chiesto da questa finestra: fa subentrare la versione nuova e ricarica. */
export function applyUpdate(): void {
  if (reloadPending.value) {
    reloadOnce()
    return
  }
  const waiting = registration?.waiting
  if (!waiting) {
    // Nessun worker in attesa (già subentrato altrove o sparito): basta ricaricare.
    reloadOnce()
    return
  }
  requestedHere = true
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

/** Da collegare a `controllerchange`: una versione nuova ha preso il controllo delle pagine. */
export function onControllerChange(): void {
  if (requestedHere) {
    reloadOnce()
  } else {
    updateReady.value = false
    reloadPending.value = true
  }
}
