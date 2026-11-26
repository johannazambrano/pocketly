/**
 * Base64 e base64url per i moduli di cifratura (`backupCrypto.ts`, `notifications/webpushCrypto.ts`).
 * La codifica procede a blocchi: `String.fromCharCode(...bytes)` su array grandi supera il limite di argomenti.
 */

const CHUNK = 0x8000

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(binary)
}

function binaryToBytes(binary: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** Decodifica base64 standard; lancia con un testo non valido. */
export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  return binaryToBytes(atob(text))
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decodifica base64url o base64 standard, con o senza `=` finali. */
export function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = '='.repeat((4 - (normalized.length % 4)) % 4)
  return binaryToBytes(atob(normalized + pad))
}
