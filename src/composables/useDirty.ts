import { computed, ref } from 'vue'

/**
 * Dice se i campi di un modulo sono cambiati da quando si è aperto. `reset()` va chiamato subito dopo aver riempito i
 * campi all'apertura; da lì in poi `dirty` è vero finché i valori sono diversi da quelli di partenza (tornando ai valori
 * iniziali torna falso). Serve alla finestra per chiedere "Scartare le modifiche?" prima di chiudersi.
 */
export function useDirty(source: object, isOpen: () => boolean) {
  const initial = ref<string | null>(null)
  const snapshot = () => JSON.stringify(source)
  function reset() {
    initial.value = snapshot()
  }
  const dirty = computed(() => isOpen() && initial.value !== null && snapshot() !== initial.value)
  return { dirty, reset }
}
