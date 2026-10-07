import type { FinanceData } from '@/types/models'
import { todayIso } from '@/utils/dates'
import { parseBackup } from './migration'

export function downloadBackup(data: FinanceData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pocketly-backup-${todayIso()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Legge un file di backup (anche quelli esportati dal prototipo HTML). */
export async function readBackupFile(file: File): Promise<FinanceData> {
  return parseBackup(JSON.parse(await file.text()))
}
