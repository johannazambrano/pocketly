/**
 * Trasporto HTTP verso il server personale (`server/main.py`), servito da nginx sotto /api/ sullo stesso indirizzo
 * dell'app. Usato dalla sincronizzazione (`sync/api.ts`) e dalle notifiche (`notifications/api.ts`).
 */

const DEFAULT_TIMEOUT_MS = 15_000

/** Chiave di accesso al server sbagliata (401). */
export class HttpAuthError extends Error {
  constructor() {
    super('invalid sync key')
    this.name = 'HttpAuthError'
  }
}

/** Troppi tentativi con la chiave sbagliata: il server si è bloccato per un po' (429). */
export class HttpBlockedError extends Error {
  constructor() {
    super('too many attempts')
    this.name = 'HttpBlockedError'
  }
}

/** Server non raggiungibile o risposta inattesa. */
export class HttpUnreachableError extends Error {
  constructor(reason: string) {
    super(`sync server unreachable: ${reason}`)
    this.name = 'HttpUnreachableError'
  }
}

export type HttpCall = (path: string, init: RequestInit) => Promise<Response>

/**
 * Restituisce una funzione che chiama `baseUrl + path` con tempo massimo, senza cache del browser, e traduce
 * 401, 429 ed errori di rete negli errori qui sopra. Gli altri stati arrivano a chi chiama.
 */
export function createHttpClient({ baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS }: { baseUrl: string; timeoutMs?: number }): HttpCall {
  return async (path, init) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(baseUrl + path, { ...init, signal: ctrl.signal, cache: 'no-store' })
      if (res.status === 401) throw new HttpAuthError()
      if (res.status === 429) throw new HttpBlockedError()
      return res
    } catch (e) {
      if (e instanceof HttpAuthError || e instanceof HttpBlockedError) throw e
      throw new HttpUnreachableError(e instanceof Error ? e.message : String(e))
    } finally {
      clearTimeout(timer)
    }
  }
}
