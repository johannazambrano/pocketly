/**
 * Logica di dominio per i Salvadanai e gli Obiettivi di Risparmio (`SavingsGoal`).
 *
 * Consente di pianificare e monitorare l'accantonamento fondi verso un traguardo
 * (es. fondo emergenza, vacanze, acquisto tecnologia), calcolando automaticamente
 * la quota mensile raccomandata in centesimi interi.
 */

import type { Cents, IsoDate, SavingsGoal } from '@/types/models'
import { parseIsoDate } from '@/utils/dates'

export type GoalStatus = 'completed' | 'active' | 'overdue'

export interface SavingsSummary {
  /** Importo totale target di tutti gli obiettivi in centesimi */
  totalTarget: Cents
  /** Importo totale accantonato finora in centesimi */
  totalCurrent: Cents
  /** Importo complessivo ancora mancante in centesimi */
  totalRemaining: Cents
  /** Somma delle quote mensili consigliate per gli obiettivi non ancora completati */
  totalMonthlyQuota: Cents
  /** Progresso globale pesato (da 0 a 1) */
  overallProgress: number
  /** Conteggio obiettivi completati (currentAmount >= targetAmount) */
  completedCount: number
  /** Conteggio obiettivi attivi nei tempi (currentAmount < targetAmount && targetDate >= today) */
  activeCount: number
  /** Conteggio obiettivi con data superata e target non raggiunto */
  overdueCount: number
  /** Conteggio totale degli obiettivi */
  totalCount: number
}

/**
 * Calcola quanti mesi mancano dalla data di oggi (`today`) alla data obiettivo (`targetDate`).
 * - Se `targetDate < today`: 0 (data già trascorsa).
 * - Se `targetDate >= today`: calcola i mesi arrotondando in base ai giorni effettivi (~30.4375 giorni/mese),
 *   con un minimo di 1 mese (il mese corrente) se la scadenza è nello stesso giorno o mese.
 */
export function calculateMonthsRemaining(today: IsoDate, targetDate: IsoDate): number {
  if (targetDate < today) return 0
  const start = parseIsoDate(today)
  const target = parseIsoDate(targetDate)
  const startTime = Date.UTC(start.year, start.month, start.day)
  const targetTime = Date.UTC(target.year, target.month, target.day)
  const diffDays = Math.round((targetTime - startTime) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 1
  return Math.max(1, Math.round(diffDays / 30.4375))
}

/**
 * Calcola l'importo rimanente in centesimi per raggiungere il target (>= 0).
 */
export function calculateRemainingAmount(goal: Pick<SavingsGoal, 'targetAmount' | 'currentAmount'>): Cents {
  return Math.max(0, goal.targetAmount - goal.currentAmount)
}

/**
 * Calcola la quota mensile raccomandata (in centesimi interi, arrotondata per eccesso)
 * per raggiungere l'importo target entro la data obiettivo.
 * - Se l'obiettivo è già completato: 0.
 * - Se la data obiettivo è superata ma l'obiettivo non è raggiunto: l'intero importo rimanente.
 * - Altrimenti: `Math.ceil(remaining / months)`.
 */
export function calculateSavingsQuota(goal: SavingsGoal, today: IsoDate): Cents {
  const remaining = calculateRemainingAmount(goal)
  if (remaining <= 0) return 0
  const months = calculateMonthsRemaining(today, goal.targetDate)
  if (months <= 0) return remaining
  return Math.ceil(remaining / months)
}

/**
 * Calcola la percentuale di avanzamento dell'obiettivo (compresa tra 0 e 1).
 */
export function calculateGoalProgress(goal: Pick<SavingsGoal, 'targetAmount' | 'currentAmount'>): number {
  if (goal.targetAmount <= 0) return 1
  return Math.min(1, Math.max(0, goal.currentAmount / goal.targetAmount))
}

/**
 * Determina lo stato operativo dell'obiettivo:
 * - 'completed': importo attuale ha raggiunto o superato il target.
 * - 'overdue': data obiettivo superata e importo non ancora raggiunto.
 * - 'active': in corso e nei tempi stabiliti.
 */
export function goalStatus(goal: SavingsGoal, today: IsoDate): GoalStatus {
  if (goal.currentAmount >= goal.targetAmount) return 'completed'
  if (goal.targetDate < today) return 'overdue'
  return 'active'
}

/**
 * Calcola statistiche aggregate su tutti i salvadanai configurati.
 */
export function savingsSummary(goals: SavingsGoal[], today: IsoDate): SavingsSummary {
  let totalTarget: Cents = 0
  let totalCurrent: Cents = 0
  let totalRemaining: Cents = 0
  let totalMonthlyQuota: Cents = 0
  let completedCount = 0
  let activeCount = 0
  let overdueCount = 0

  for (const g of goals) {
    totalTarget += g.targetAmount
    totalCurrent += g.currentAmount
    const remaining = calculateRemainingAmount(g)
    totalRemaining += remaining

    const st = goalStatus(g, today)
    if (st === 'completed') {
      completedCount++
    } else if (st === 'overdue') {
      overdueCount++
      totalMonthlyQuota += remaining
    } else {
      activeCount++
      totalMonthlyQuota += calculateSavingsQuota(g, today)
    }
  }

  const overallProgress = totalTarget > 0 ? Math.min(1, Math.max(0, totalCurrent / totalTarget)) : 0

  return {
    totalTarget,
    totalCurrent,
    totalRemaining,
    totalMonthlyQuota,
    overallProgress,
    completedCount,
    activeCount,
    overdueCount,
    totalCount: goals.length,
  }
}

/**
 * Ordina gli obiettivi per la vista:
 * 1. Obiettivi scaduti (necessitano attenzione immediata)
 * 2. Obiettivi attivi con scadenza più vicina
 * 3. Obiettivi completati in fondo
 */
export function sortSavingsGoals(goals: SavingsGoal[], today: IsoDate): SavingsGoal[] {
  return [...goals].sort((a, b) => {
    const statusA = goalStatus(a, today)
    const statusB = goalStatus(b, today)

    // Completati in fondo
    if (statusA === 'completed' && statusB !== 'completed') return 1
    if (statusB === 'completed' && statusA !== 'completed') return -1

    // Scaduti in cima
    if (statusA === 'overdue' && statusB !== 'overdue') return -1
    if (statusB === 'overdue' && statusA !== 'overdue') return 1

    // Per data obiettivo crescente (quelli che scadono prima per primi)
    const dateComp = a.targetDate.localeCompare(b.targetDate)
    if (dateComp !== 0) return dateComp

    return a.name.localeCompare(b.name)
  })
}
