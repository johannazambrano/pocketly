import type { FinanceData } from '@/types/models'

/** Giorni dopo i quali, se i dati sono cambiati dall'ultimo backup, l'app lo ricorda. */
export const REMINDER_DAYS = 7
/** Quanto tace il promemoria dopo "Più tardi". */
export const SNOOZE_DAYS = 1

export interface BackupMeta {
  /** Prima volta che l'app ha avviato il controllo: punto di partenza se non c'è mai stato un backup. */
  startedAt: string
  /** Ultimo backup esportato o ripristino riuscito. */
  lastBackupAt: string | null
  /** Impronta dei dati in quel momento: se è uguale a quella di adesso non c'è nulla di nuovo da salvare. */
  lastBackupHash: string | null
  snoozedUntil: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS))
}

/** Vero se c'è almeno un dato inserito dall'utente (le sole categorie predefinite non valgono un backup). */
export function hasUserData(data: FinanceData): boolean {
  return data.oneTimeExpenses.length + data.incomes.length + data.recurringExpenses.length + data.loans.length > 0
}

export function isReminderDue(meta: BackupMeta, currentHash: string, hasData: boolean, now: Date): boolean {
  if (!hasData) return false
  if (meta.lastBackupHash === currentHash) return false
  if (meta.snoozedUntil && new Date(meta.snoozedUntil).getTime() > now.getTime()) return false
  return daysSince(meta.lastBackupAt ?? meta.startedAt, now) >= REMINDER_DAYS
}
