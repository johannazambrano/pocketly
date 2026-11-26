import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpClient, HttpAuthError, HttpBlockedError, HttpUnreachableError } from './http'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('createHttpClient', () => {
  it('chiama baseUrl + path senza cache e restituisce la risposta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await createHttpClient({ baseUrl: '/api' })('/health', { method: 'GET' })
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET', cache: 'no-store' }))
  })

  it('lascia passare gli altri stati a chi chiama', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 409 })))
    expect((await createHttpClient({ baseUrl: '' })('/x', {})).status).toBe(409)
  })

  it('traduce 401 e 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    await expect(createHttpClient({ baseUrl: '' })('/x', {})).rejects.toBeInstanceOf(HttpAuthError)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })))
    await expect(createHttpClient({ baseUrl: '' })('/x', {})).rejects.toBeInstanceOf(HttpBlockedError)
  })

  it('un errore di rete diventa HttpUnreachableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(createHttpClient({ baseUrl: '' })('/x', {})).rejects.toBeInstanceOf(HttpUnreachableError)
  })

  it('interrompe la richiesta dopo il tempo massimo', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
      ),
    )
    const pending = createHttpClient({ baseUrl: '', timeoutMs: 1000 })('/x', {})
    const check = expect(pending).rejects.toBeInstanceOf(HttpUnreachableError)
    await vi.advanceTimersByTimeAsync(1000)
    await check
  })
})
