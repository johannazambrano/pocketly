import { describe, expect, it } from 'vitest'
import type { SavingsGoal } from '@/types/models'
import {
  calculateGoalProgress,
  calculateMonthsRemaining,
  calculateRemainingAmount,
  calculateSavingsQuota,
  goalStatus,
  savingsSummary,
  sortSavingsGoals,
} from './savings'

describe('savings domain', () => {
  const TODAY = '2026-05-15'

  function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
    return {
      id: 'g-1',
      name: 'Fondo emergenza',
      targetAmount: 120000, // 1200,00 €
      currentAmount: 0,
      targetDate: '2027-05-15', // 12 mesi esatti
      ...overrides,
    }
  }

  describe('calculateMonthsRemaining', () => {
    it('restituisce 0 se la data obiettivo è trascorsa prima di oggi', () => {
      expect(calculateMonthsRemaining(TODAY, '2026-05-14')).toBe(0)
      expect(calculateMonthsRemaining(TODAY, '2025-12-31')).toBe(0)
    })

    it('restituisce 1 se la data obiettivo è oggi o nello stesso mese', () => {
      expect(calculateMonthsRemaining(TODAY, TODAY)).toBe(1)
      expect(calculateMonthsRemaining(TODAY, '2026-05-20')).toBe(1)
      expect(calculateMonthsRemaining(TODAY, '2026-05-31')).toBe(1)
    })

    it('calcola correttamente i mesi per scadenze future', () => {
      expect(calculateMonthsRemaining(TODAY, '2026-06-15')).toBe(1)
      expect(calculateMonthsRemaining(TODAY, '2026-07-15')).toBe(2)
      expect(calculateMonthsRemaining(TODAY, '2026-11-15')).toBe(6)
      expect(calculateMonthsRemaining(TODAY, '2027-05-15')).toBe(12)
    })
  })

  describe('calculateRemainingAmount', () => {
    it('calcola l importo residuo corretto', () => {
      expect(calculateRemainingAmount({ targetAmount: 10000, currentAmount: 4000 })).toBe(6000)
    })

    it('restituisce 0 se già raggiunto o superato', () => {
      expect(calculateRemainingAmount({ targetAmount: 10000, currentAmount: 10000 })).toBe(0)
      expect(calculateRemainingAmount({ targetAmount: 10000, currentAmount: 15000 })).toBe(0)
    })
  })

  describe('calculateSavingsQuota', () => {
    it('restituisce 0 se l obiettivo è già raggiunto', () => {
      const g = makeGoal({ targetAmount: 10000, currentAmount: 10000 })
      expect(calculateSavingsQuota(g, TODAY)).toBe(0)
    })

    it('suddivide l importo mancante per i mesi rimanenti', () => {
      // 1200,00 € in 12 mesi = 100,00 € al mese (10000 centesimi)
      const g = makeGoal({ targetAmount: 120000, currentAmount: 0, targetDate: '2027-05-15' })
      expect(calculateSavingsQuota(g, TODAY)).toBe(10000)
    })

    it('tiene conto dell importo già accantonato', () => {
      // Target 1200,00 €, attuale 600,00 €, mancano 600,00 € in 6 mesi = 100,00 €/mese
      const g = makeGoal({ targetAmount: 120000, currentAmount: 60000, targetDate: '2026-11-15' })
      expect(calculateSavingsQuota(g, TODAY)).toBe(10000)
    })

    it('arrotonda per eccesso in caso di divisione non intera per garantire il raggiungimento', () => {
      // 1000,00 € (100000 centesimi) in 3 mesi = 33333.33 -> 33334 centesimi
      const g = makeGoal({ targetAmount: 100000, currentAmount: 0, targetDate: '2026-08-15' })
      expect(calculateSavingsQuota(g, TODAY)).toBe(33334)
    })

    it('se la data è scaduta ma il target non è raggiunto richiede l intero importo mancante', () => {
      const g = makeGoal({ targetAmount: 50000, currentAmount: 20000, targetDate: '2026-04-01' })
      expect(calculateSavingsQuota(g, TODAY)).toBe(30000)
    })
  })

  describe('calculateGoalProgress', () => {
    it('calcola la frazione compresa tra 0 e 1', () => {
      expect(calculateGoalProgress({ targetAmount: 10000, currentAmount: 0 })).toBe(0)
      expect(calculateGoalProgress({ targetAmount: 10000, currentAmount: 2500 })).toBe(0.25)
      expect(calculateGoalProgress({ targetAmount: 10000, currentAmount: 10000 })).toBe(1)
    })

    it('limita il progresso a 1 anche in caso di eccedenza', () => {
      expect(calculateGoalProgress({ targetAmount: 10000, currentAmount: 15000 })).toBe(1)
    })

    it('gestisce target <= 0 senza dividere per zero', () => {
      expect(calculateGoalProgress({ targetAmount: 0, currentAmount: 0 })).toBe(1)
    })
  })

  describe('goalStatus', () => {
    it('distingue tra completed, overdue e active', () => {
      // Completato
      expect(goalStatus(makeGoal({ targetAmount: 10000, currentAmount: 10000, targetDate: '2026-01-01' }), TODAY)).toBe('completed')
      expect(goalStatus(makeGoal({ targetAmount: 10000, currentAmount: 12000, targetDate: '2027-01-01' }), TODAY)).toBe('completed')

      // Scaduto
      expect(goalStatus(makeGoal({ targetAmount: 10000, currentAmount: 5000, targetDate: '2026-05-14' }), TODAY)).toBe('overdue')

      // In corso
      expect(goalStatus(makeGoal({ targetAmount: 10000, currentAmount: 5000, targetDate: '2026-05-16' }), TODAY)).toBe('active')
      expect(goalStatus(makeGoal({ targetAmount: 10000, currentAmount: 5000, targetDate: TODAY }), TODAY)).toBe('active')
    })
  })

  describe('savingsSummary', () => {
    it('gestisce una lista vuota senza errori', () => {
      const summary = savingsSummary([], TODAY)
      expect(summary).toEqual({
        totalTarget: 0,
        totalCurrent: 0,
        totalRemaining: 0,
        totalMonthlyQuota: 0,
        overallProgress: 0,
        completedCount: 0,
        activeCount: 0,
        overdueCount: 0,
        totalCount: 0,
      })
    })

    it('calcola correttamente i totali e i conteggi con obiettivi misti', () => {
      const goals: SavingsGoal[] = [
        // 1. Completato
        makeGoal({ id: '1', name: 'Completato', targetAmount: 50000, currentAmount: 50000, targetDate: '2026-06-01' }),
        // 2. Attivo: 120000 target, 60000 attuale, mancano 60000 in 6 mesi (10000/mese)
        makeGoal({ id: '2', name: 'Attivo', targetAmount: 120000, currentAmount: 60000, targetDate: '2026-11-15' }),
        // 3. Scaduto: 30000 target, 10000 attuale, mancano 20000 (quota mensile = 20000)
        makeGoal({ id: '3', name: 'Scaduto', targetAmount: 30000, currentAmount: 10000, targetDate: '2026-04-01' }),
      ]

      const summary = savingsSummary(goals, TODAY)

      expect(summary.totalTarget).toBe(200000) // 500 + 1200 + 300
      expect(summary.totalCurrent).toBe(120000) // 500 + 600 + 100
      expect(summary.totalRemaining).toBe(80000) // 0 + 600 + 200
      expect(summary.totalMonthlyQuota).toBe(30000) // 0 + 10000 + 20000
      expect(summary.overallProgress).toBe(0.6) // 120000 / 200000
      expect(summary.completedCount).toBe(1)
      expect(summary.activeCount).toBe(1)
      expect(summary.overdueCount).toBe(1)
      expect(summary.totalCount).toBe(3)
    })
  })

  describe('sortSavingsGoals', () => {
    it('ordina con scaduti in cima, attivi per data crescente e completati in fondo', () => {
      const gOverdue = makeGoal({ id: 'overdue', name: 'Z Scaduto', targetAmount: 1000, currentAmount: 0, targetDate: '2026-01-01' })
      const gActiveSoon = makeGoal({ id: 'activeSoon', name: 'Attivo Presto', targetAmount: 1000, currentAmount: 0, targetDate: '2026-06-01' })
      const gActiveLater = makeGoal({ id: 'activeLater', name: 'Attivo Tardi', targetAmount: 1000, currentAmount: 0, targetDate: '2027-01-01' })
      const gCompleted = makeGoal({ id: 'completed', name: 'A Completato', targetAmount: 1000, currentAmount: 1000, targetDate: '2026-01-01' })

      const sorted = sortSavingsGoals([gCompleted, gActiveLater, gOverdue, gActiveSoon], TODAY)

      expect(sorted.map((g) => g.id)).toEqual(['overdue', 'activeSoon', 'activeLater', 'completed'])
    })
  })
})
