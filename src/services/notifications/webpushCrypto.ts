/**
 * Crittografia Web Push lato client secondo RFC 8291 (aes128gcm) e RFC 8188.
 *
 * Il testo della notifica viene cifrato nel browser con la chiave pubblica `p256dh`
 * e il segreto `auth` della PushSubscription del dispositivo destinatario, usando
 * esclusivamente Web Crypto API (`crypto.subtle`).
 * Sul server finiscono solo i byte già cifrati: il server non conosce la chiave privata
 * del browser e non vede mai i nomi o gli importi delle spese in chiaro.
 */

const WEB_PUSH_INFO_PREFIX = new TextEncoder().encode('WebPush: info\x00')
const CEK_INFO = new TextEncoder().encode('Content-Encoding: aes128gcm\x00')
const NONCE_INFO = new TextEncoder().encode('Content-Encoding: nonce\x00')
const RECORD_SIZE = 4096

function concatBytes(...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = arrays.reduce((acc, a) => acc + a.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.byteLength
  }
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decodifica una stringa base64 o base64url in `Uint8Array`. */
export function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(normalized + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

async function hkdfDeriveBytes(
  ikm: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  byteLength: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial,
    byteLength * 8,
  )
  return new Uint8Array(bits)
}

/**
 * Cifra un payload testuale secondo RFC 8291 (`Content-Encoding: aes128gcm`) e restituisce
 * il pacchetto binario completo codificato in base64 standard, pronto per l'invio HTTP POST.
 */
export async function encryptWebPushPayload(
  plaintext: string,
  p256dhBase64Url: string,
  authBase64Url: string,
): Promise<string> {
  const uaPublic = base64UrlToBytes(p256dhBase64Url)
  const authSecret = base64UrlToBytes(authBase64Url)
  if (uaPublic.byteLength !== 65 || uaPublic[0] !== 0x04) {
    throw new Error('Invalid p256dh public key')
  }
  if (authSecret.byteLength !== 16) {
    throw new Error('Invalid auth secret')
  }

  // 1. Chiave effimera ECDH P-256 del mittente (as_keypair)
  const asKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey))

  // 2. Segreto condiviso ECDH con la chiave pubblica del browser destinatario (ua_public)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeyPair.privateKey, 256),
  )

  // 3. Derivazione IKM (RFC 8291 §3.3): HKDF-SHA-256(salt=auth_secret, IKM=ecdh_secret, info="WebPush: info\0" || ua_public || as_public)
  const keyInfo = concatBytes(WEB_PUSH_INFO_PREFIX, uaPublic, asPublic)
  const ikm = await hkdfDeriveBytes(ecdhSecret, authSecret, keyInfo, 32)

  // 4. Derivazione CEK (16B) e Nonce (12B) con sale casuale di 16B (RFC 8188 §2.2 / §2.3)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cekBytes = await hkdfDeriveBytes(ikm, salt, CEK_INFO, 16)
  const nonce = await hkdfDeriveBytes(ikm, salt, NONCE_INFO, 12)

  // 5. Record RFC 8188: payload UTF-8 seguito dal delimitatore 0x02
  const payloadBytes = new TextEncoder().encode(plaintext)
  const record = concatBytes(payloadBytes, new Uint8Array([0x02]))

  const cekKey = await crypto.subtle.importKey('raw', cekBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, record))

  // 6. Intestazione RFC 8188: salt (16) || rs (4, big-endian) || idlen (1 = 65) || keyid (as_public, 65)
  const header = new Uint8Array(16 + 4 + 1 + asPublic.byteLength)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false)
  header[20] = asPublic.byteLength
  header.set(asPublic, 21)

  return bytesToBase64(concatBytes(header, ciphertext))
}

/**
 * Decifra un pacchetto RFC 8291 (`aes128gcm`) usando la chiave privata del destinatario.
 * Usata nei test per verificare la conformità allo standard RFC 8291.
 */
export async function decryptWebPushPayload(
  encryptedBase64: string,
  uaPrivateKey: CryptoKey,
  uaPublicBytes: Uint8Array<ArrayBuffer>,
  authSecret: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const raw = base64UrlToBytes(encryptedBase64)
  if (raw.byteLength < 86 + 17) throw new Error('Encrypted payload too short')

  const salt = raw.slice(0, 16)
  const idlen = raw[20]!
  if (idlen !== 65) throw new Error(`Unexpected keyid length: ${idlen}`)
  const asPublic = raw.slice(21, 21 + idlen)
  const ciphertext = raw.slice(21 + idlen)

  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPrivateKey, 256))

  const keyInfo = concatBytes(WEB_PUSH_INFO_PREFIX, uaPublicBytes, asPublic)
  const ikm = await hkdfDeriveBytes(ecdhSecret, authSecret, keyInfo, 32)
  const cekBytes = await hkdfDeriveBytes(ikm, salt, CEK_INFO, 16)
  const nonce = await hkdfDeriveBytes(ikm, salt, NONCE_INFO, 12)

  const cekKey = await crypto.subtle.importKey('raw', cekBytes, { name: 'AES-GCM' }, false, ['decrypt'])
  const plainRecord = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cekKey, ciphertext))

  // Rimuove eventuale padding 0x00 in coda e verifica il delimitatore 0x02
  let end = plainRecord.byteLength - 1
  while (end >= 0 && plainRecord[end] === 0x00) end--
  if (end < 0 || plainRecord[end] !== 0x02) throw new Error('Invalid RFC 8188 record delimiter')

  return new TextDecoder().decode(plainRecord.subarray(0, end))
}
