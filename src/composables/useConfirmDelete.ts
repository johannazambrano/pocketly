import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'

/** Chiede conferma prima di eliminare una voce, poi esegue `action`. */
export function useConfirmDelete() {
  const { t } = useI18n()
  const ui = useUiStore()
  return async (name: string, action: () => void) => {
    const ok = await ui.confirm({
      title: t('common.delete'),
      message: t('common.deleteQuestion', { name }),
      confirmLabel: t('common.confirmDelete'),
    })
    if (ok) action()
  }
}
