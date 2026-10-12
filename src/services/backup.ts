import type { FinanceData } from '@/types/models'
import { todayIso } from '@/utils/dates'
import { decryptBackup, encryptBackup, isEncryptedBackup, WrongPasswordError } from './backupCrypto'
import { BackupFormatError, parseBackup } from './migration'

export type ExportMode = 'download' | 'share'
/** `cancelled`: l'utente ha chiuso il foglio di condivisione, il backup non è stato salvato. */
export type ExportResult = 'downloaded' | 'shared' | 'cancelled'

/** Contenuto del file: JSON in chiaro, oppure busta cifrata se è stata scelta una password. */
export async function serializeBackup(data: FinanceData, password?: string): Promise<string> {
  const json = JSON.stringify(data, null, 2)
  if (!password) return json
  return JSON.stringify(await encryptBackup(json, password))
}

function backupFileName(protectedByPassword: boolean): string {
  return `pocketly-backup-${todayIso()}${protectedByPassword ? '-protetto' : ''}.json`
}

/**
 * Il menu Condividi di sistema (iCloud Drive, Google Drive, email, WhatsApp…) è la strada più comoda
 * dal telefono. Sul PC è meglio un normale download, quindi lo proponiamo solo su schermi touch.
 */
export function canShareBackup(): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || !navigator.share) return false
    if (!window.matchMedia?.('(pointer: coarse)').matches) return false
    return navigator.canShare({ files: [new File(['{}'], 'test.json', { type: 'application/json' })] })
  } catch {
    return false
  }
}

function download(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revocare subito può interrompere il download su alcuni browser mobili.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Esporta il backup. Se la condivisione non è consentita (ad esempio perché la cifratura ha impiegato
 * troppo e il browser considera scaduto il tocco dell'utente) ripiega sul download.
 */
export async function exportBackup(data: FinanceData, mode: ExportMode, password?: string): Promise<ExportResult> {
  const file = new File([await serializeBackup(data, password)], backupFileName(!!password), { type: 'application/json' })
  if (mode === 'share') {
    try {
      await navigator.share({ files: [file], title: 'Pocketly' })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // NotAllowedError o simili: si ripiega sul download
    }
  }
  download(file)
  return 'downloaded'
}

/**
 * Legge un file di backup (anche quelli esportati dal prototipo HTML).
 * Se il file è protetto, chiama `askPassword` finché la password è giusta; `null` = l'utente annulla.
 * `retry` è true dal secondo tentativo, così la finestra può mostrare "password errata".
 */
export async function readBackupFile(
  file: File,
  askPassword: (retry: boolean) => Promise<string | null>,
): Promise<FinanceData | null> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new BackupFormatError('not json')
  }
  if (!isEncryptedBackup(raw)) return parseBackup(raw)

  for (let retry = false; ; retry = true) {
    const password = await askPassword(retry)
    if (password === null) return null
    try {
      return parseBackup(JSON.parse(await decryptBackup(raw, password)))
    } catch (e) {
      if (!(e instanceof WrongPasswordError)) throw e
    }
  }
}
