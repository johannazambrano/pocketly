import { onBeforeUnmount, watchEffect } from 'vue'
import { useUiStore, type PageAction } from '@/stores/ui'

/**
 * Registra l'azione "+" contestuale della vista attiva finché è montata.
 * Usa un token `symbol` per evitare che la vista uscente cancelli l'azione della nuova vista durante i cambi rotta.
 */
export function usePageAction(resolve: () => PageAction | null): void {
  const ui = useUiStore()
  const owner = Symbol('page-action')
  watchEffect(() => ui.setPageAction(owner, resolve()))
  onBeforeUnmount(() => ui.clearPageAction(owner))
}
