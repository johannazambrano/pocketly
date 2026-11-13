import type { OneTimeExpense, QuickExpense } from '@/types/models'
import { useFormat } from '@/i18n'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'

/**
 * Azione condivisa per gli inserimenti rapidi:
 * - se il rapido ha un importo fisso, registra subito la spesa e mostra un toast con «Modifica» e «Annulla»;
 * - se l'importo è libero (o l'utente sceglie di modificare prima), apre o precompila il modulo spesa.
 */
export function useQuickExpenseTrigger() {
  const finance = useFinanceStore()
  const ui = useUiStore()
  const { t, money } = useFormat()

  function prefill(preset: QuickExpense, onPrefill?: (preset: QuickExpense) => void) {
    if (onPrefill) onPrefill(preset)
    else ui.openQuickAddFromPreset(preset)
  }

  function trigger(
    preset: QuickExpense,
    options?: {
      onPrefill?: (preset: QuickExpense) => void
      onRecorded?: (expense: OneTimeExpense) => void
    },
  ) {
    if (!preset.amount || preset.amount <= 0) {
      prefill(preset, options?.onPrefill)
      return
    }
    const created = finance.triggerQuickExpense(preset)
    if (!created) {
      ui.toast(t('common.noTags'), 'error')
      return
    }
    options?.onRecorded?.(created)
    ui.toast(t('quickExpenses.recordedToast', { name: created.name, amount: money(created.amount) }), 'success', {
      actions: [
        {
          label: t('common.edit'),
          onClick: () => {
            const current = finance.data.oneTimeExpenses.find((e) => e.id === created.id)
            if (current) ui.openQuickEdit(current)
          },
        },
        {
          label: t('quickExpenses.undo'),
          onClick: () => {
            finance.deleteOneTime(created.id)
            ui.toast(t('quickExpenses.undoneToast', { name: created.name }))
          },
        },
      ],
    })
  }

  return { trigger, prefill }
}
