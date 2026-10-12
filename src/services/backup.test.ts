import { describe, expect, it } from 'vitest'
import { createDefaultData } from '@/domain/defaults'
import { fingerprint, stableStringify } from '@/utils/hash'
import { readBackupFile, serializeBackup } from './backup'
import {
  decryptBackup,
  encryptBackup,
  ENCRYPTED_FORMAT,
  EncryptedBackupFormatError,
  isEncryptedBackup,
  WrongPasswordError,
} from './backupCrypto'

const sample = () => {
  const data = createDefaultData('it')
  data.oneTimeExpenses.push({
    id: 'e1',
    name: 'Caffè ☕ perché sì',
    amount: 123,
    categoryId: data.categories[0]!.id,
    paymentMethodId: data.paymentMethods[0]!.id,
    date: '2026-10-01',
    notes: '',
  } as (typeof data.oneTimeExpenses)[number])
  return data
}

const asFile = (text: string) => new File([text], 'backup.json', { type: 'application/json' })

describe('backupCrypto', () => {
  it('cifra e decifra, anche con accenti ed emoji', async () => {
    const env = await encryptBackup('{"a":"è ☕"}', 'password-lunga-1')
    expect(env.format).toBe(ENCRYPTED_FORMAT)
    expect(isEncryptedBackup(env)).toBe(true)
    expect(env.data).not.toContain('☕')
    expect(await decryptBackup(env, 'password-lunga-1')).toBe('{"a":"è ☕"}')
  })

  it('con la stessa password produce ogni volta un file diverso (sale e IV casuali)', async () => {
    const a = await encryptBackup('x', 'password-lunga-1')
    const b = await encryptBackup('x', 'password-lunga-1')
    expect(a.salt).not.toBe(b.salt)
    expect(a.data).not.toBe(b.data)
  })

  it('rifiuta la password sbagliata', async () => {
    const env = await encryptBackup('segreto', 'password-lunga-1')
    await expect(decryptBackup(env, 'password-lunga-2')).rejects.toBeInstanceOf(WrongPasswordError)
  })

  it('rileva un file alterato', async () => {
    const env = await encryptBackup('segreto', 'password-lunga-1')
    const bytes = Uint8Array.from(atob(env.data), (c) => c.charCodeAt(0))
    bytes[0] = bytes[0]! ^ 1
    const tampered = { ...env, data: btoa(String.fromCharCode(...bytes)) }
    await expect(decryptBackup(tampered, 'password-lunga-1')).rejects.toBeInstanceOf(WrongPasswordError)
  })

  it('accetta la stessa password con accenti composti o scomposti', async () => {
    const env = await encryptBackup('x', 'pérché-ok')
    expect(await decryptBackup(env, 'pérché-ok')).toBe('x')
  })

  it('rifiuta numeri di iterazioni fuori scala (file costruiti ad arte)', async () => {
    const env = await encryptBackup('x', 'password-lunga-1')
    await expect(decryptBackup({ ...env, iterations: 2_000_000_000 }, 'password-lunga-1')).rejects.toBeInstanceOf(
      EncryptedBackupFormatError,
    )
    await expect(decryptBackup({ ...env, iterations: 1 }, 'password-lunga-1')).rejects.toBeInstanceOf(
      EncryptedBackupFormatError,
    )
  })

  it('rifiuta dati non base64', async () => {
    const env = await encryptBackup('x', 'password-lunga-1')
    await expect(decryptBackup({ ...env, iv: '***' }, 'password-lunga-1')).rejects.toBeInstanceOf(
      EncryptedBackupFormatError,
    )
  })
})

describe('serializeBackup / readBackupFile', () => {
  it('senza password il file è un backup in chiaro leggibile', async () => {
    const data = sample()
    const text = await serializeBackup(data)
    expect(isEncryptedBackup(JSON.parse(text))).toBe(false)
    const back = await readBackupFile(asFile(text), async () => {
      throw new Error('non deve chiedere la password')
    })
    expect(back).toEqual(data)
  })

  it('con password il file non contiene i dati in chiaro e si riapre con la password giusta', async () => {
    const data = sample()
    const text = await serializeBackup(data, 'password-lunga-1')
    expect(text).not.toContain('Caffè')
    const back = await readBackupFile(asFile(text), async () => 'password-lunga-1')
    expect(back).toEqual(data)
  })

  it('richiede di nuovo la password finché è sbagliata, segnalando il nuovo tentativo', async () => {
    const text = await serializeBackup(sample(), 'password-lunga-1')
    const asked: boolean[] = []
    const answers = ['sbagliata-1', 'sbagliata-2', 'password-lunga-1']
    const back = await readBackupFile(asFile(text), async (retry) => {
      asked.push(retry)
      return answers.shift() ?? null
    })
    expect(back).not.toBeNull()
    expect(asked).toEqual([false, true, true])
  })

  it('restituisce null se l’utente annulla la richiesta della password', async () => {
    const text = await serializeBackup(sample(), 'password-lunga-1')
    expect(await readBackupFile(asFile(text), async () => null)).toBeNull()
  })

  it('un file che non è JSON dà errore di formato', async () => {
    await expect(readBackupFile(asFile('ciao'), async () => null)).rejects.toThrow()
  })
})

describe('impronta dei dati', () => {
  it('non dipende dall’ordine delle chiavi', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }))
    expect(fingerprint(stableStringify({ b: 1, a: 2 }))).toBe(fingerprint(stableStringify({ a: 2, b: 1 })))
  })

  it('cambia quando cambia un dato', () => {
    const a = fingerprint(stableStringify({ x: [1, 2, 3] }))
    expect(fingerprint(stableStringify({ x: [1, 2, 4] }))).not.toBe(a)
    expect(fingerprint(stableStringify({ x: [1, 3, 2] }))).not.toBe(a)
  })
})
