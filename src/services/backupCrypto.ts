/**
 * Cifratura facoltativa dei backup con una password scelta dall'utente.
 * Password → chiave con PBKDF2-SHA-256, poi AES-256-GCM (cifra e verifica che il file non sia stato alterato).
 * Nulla lascia il dispositivo e la password non viene mai salvata.
 * Servono le API Web Crypto, disponibili solo in un contesto sicuro (HTTPS o localhost).
 */

export const ENCRYPTED_FORMAT = 'pocketly-encrypted-backup'
export const MIN_PASSWORD_LENGTH = 8

const KDF_ITERATIONS = 600_000
// Limiti accettati in lettura: un file costruito ad arte non deve bloccare il dispositivo.
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 5_000_000
const SALT_BYTES = 16
const IV_BYTES = 12
const AAD = new TextEncoder().encode(ENCRYPTED_FORMAT + ':1')

export interface EncryptedBackup {
  format: typeof ENCRYPTED_FORMAT
  version: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  /** Contenuto cifrato (base64), con in coda il codice di autenticazione di AES-GCM. */
  data: string
}

/** Password errata oppure file alterato/danneggiato: AES-GCM non permette di distinguere i due casi. */
export class WrongPasswordError extends Error {
  constructor() {
    super('wrong password or corrupted file')
    this.name = 'WrongPasswordError'
  }
}

export class CryptoUnavailableError extends Error {
  constructor() {
    super('Web Crypto not available (secure context required)')
    this.name = 'CryptoUnavailableError'
  }
}

export class EncryptedBackupFormatError extends Error {
  constructor(reason: string) {
    super(`invalid encrypted backup: ${reason}`)
    this.name = 'EncryptedBackupFormatError'
  }
}

export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.getRandomValues === 'function'
}

export function isEncryptedBackup(raw: unknown): raw is EncryptedBackup {
  return typeof raw === 'object' && raw !== null && (raw as { format?: unknown }).format === ENCRYPTED_FORMAT
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  // NFC: la stessa password digitata su tastiere diverse (accenti composti o scomposti) dà la stessa chiave.
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackup(plaintext: string, password: string): Promise<EncryptedBackup> {
  if (!isCryptoAvailable()) throw new CryptoUnavailableError()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt, KDF_ITERATIONS)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    format: ENCRYPTED_FORMAT,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  }
}

export async function decryptBackup(file: EncryptedBackup, password: string): Promise<string> {
  if (!isCryptoAvailable()) throw new CryptoUnavailableError()
  if (file.version !== 1 || file.kdf !== 'PBKDF2-SHA256') throw new EncryptedBackupFormatError('unsupported version')
  if (!Number.isInteger(file.iterations) || file.iterations < MIN_ITERATIONS || file.iterations > MAX_ITERATIONS) {
    throw new EncryptedBackupFormatError('iterations out of range')
  }
  let salt: Uint8Array<ArrayBuffer>
  let iv: Uint8Array<ArrayBuffer>
  let data: Uint8Array<ArrayBuffer>
  try {
    salt = fromBase64(file.salt)
    iv = fromBase64(file.iv)
    data = fromBase64(file.data)
  } catch {
    throw new EncryptedBackupFormatError('bad encoding')
  }
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || data.length < 16) {
    throw new EncryptedBackupFormatError('bad sizes')
  }
  const key = await deriveKey(password, salt, file.iterations)
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    throw new WrongPasswordError()
  }
}
