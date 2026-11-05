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

/**
 * Chiave per cifrare con un sale fisso: la sincronizzazione la calcola una volta per dispositivo e la riusa,
 * invece di ripetere le 600.000 iterazioni a ogni invio.
 */
export interface DerivedKey {
  key: CryptoKey
  salt: string
  iterations: number
}

export async function deriveBackupKey(password: string, salt?: string, iterations = KDF_ITERATIONS): Promise<DerivedKey> {
  if (!isCryptoAvailable()) throw new CryptoUnavailableError()
  checkIterations(iterations)
  const saltBytes = salt ? decodeSized(salt, SALT_BYTES) : crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  return { key: await deriveKey(password, saltBytes, iterations), salt: toBase64(saltBytes), iterations }
}

/** Cifra con una chiave già calcolata. Il risultato è un normale backup protetto, apribile con la password. */
export async function encryptWithKey(plaintext: string, derived: DerivedKey): Promise<EncryptedBackup> {
  if (!isCryptoAvailable()) throw new CryptoUnavailableError()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD },
    derived.key,
    new TextEncoder().encode(plaintext),
  )
  return {
    format: ENCRYPTED_FORMAT,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: derived.iterations,
    salt: derived.salt,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  }
}

export async function encryptBackup(plaintext: string, password: string): Promise<EncryptedBackup> {
  return encryptWithKey(plaintext, await deriveBackupKey(password))
}

function checkIterations(iterations: number): void {
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    throw new EncryptedBackupFormatError('iterations out of range')
  }
}

function decodeSized(text: string, size: number): Uint8Array<ArrayBuffer> {
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = fromBase64(text)
  } catch {
    throw new EncryptedBackupFormatError('bad encoding')
  }
  if (bytes.length !== size) throw new EncryptedBackupFormatError('bad sizes')
  return bytes
}

function checkFormat(file: EncryptedBackup): void {
  if (file.version !== 1 || file.kdf !== 'PBKDF2-SHA256') throw new EncryptedBackupFormatError('unsupported version')
  checkIterations(file.iterations)
}

/** Decifra con una chiave già calcolata; la chiave deve essere stata calcolata con lo stesso sale del file. */
export async function decryptWithKey(file: EncryptedBackup, derived: DerivedKey): Promise<string> {
  if (!isCryptoAvailable()) throw new CryptoUnavailableError()
  checkFormat(file)
  if (file.salt !== derived.salt || file.iterations !== derived.iterations) throw new WrongPasswordError()
  const iv = decodeSized(file.iv, IV_BYTES)
  let data: Uint8Array<ArrayBuffer>
  try {
    data = fromBase64(file.data)
  } catch {
    throw new EncryptedBackupFormatError('bad encoding')
  }
  if (data.length < 16) throw new EncryptedBackupFormatError('bad sizes')
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, derived.key, data)
    return new TextDecoder().decode(plain)
  } catch {
    throw new WrongPasswordError()
  }
}

export async function decryptBackup(file: EncryptedBackup, password: string): Promise<string> {
  if (!isCryptoAvailable()) throw new CryptoUnavailableError()
  checkFormat(file)
  // Le dimensioni si controllano prima di calcolare la chiave, che è l'operazione lenta.
  decodeSized(file.salt, SALT_BYTES)
  decodeSized(file.iv, IV_BYTES)
  return decryptWithKey(file, await deriveBackupKey(password, file.salt, file.iterations))
}
