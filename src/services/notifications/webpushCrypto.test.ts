import { describe, expect, it } from 'vitest'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptWebPushPayload,
  encryptWebPushPayload,
} from './webpushCrypto'

describe('webpushCrypto (RFC 8291 aes128gcm)', () => {
  it('cifra e decifra correttamente un payload UTF-8 con caratteri accentati e simboli €', async () => {
    const uaKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const uaPubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeyPair.publicKey))
    const authBytes = crypto.getRandomValues(new Uint8Array(16))

    const p256dh = bytesToBase64Url(uaPubBytes)
    const auth = bytesToBase64Url(authBytes)
    const message = JSON.stringify({
      id: 'rec-1:2026-11-15:1:09:00',
      title: 'Affitto in scadenza',
      body: 'Domani addebito di 550,00 € (Caffè & Bollette)',
      url: '/ricorrenti',
    })

    const encrypted = await encryptWebPushPayload(message, p256dh, auth)
    expect(typeof encrypted).toBe('string')
    // Non deve contenere il testo in chiaro
    const rawBytes = base64UrlToBytes(encrypted)
    const rawText = new TextDecoder().decode(rawBytes)
    expect(rawText).not.toContain('Affitto')
    expect(rawText).not.toContain('550,00')

    const decrypted = await decryptWebPushPayload(encrypted, uaKeyPair.privateKey, uaPubBytes, authBytes)
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(message))
  })

  it('rifiuta chiavi p256dh o segreti auth malformati', async () => {
    await expect(encryptWebPushPayload('test', 'abc', 'def')).rejects.toThrow()
  })
})
