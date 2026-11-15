import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** Per quanto resta segnata la voce aperta dalla ricerca. */
export const HIGHLIGHT_MS = 4000

/**
 * La voce aperta dalla ricerca (`?highlight=<id>`): la porta in vista, la segna per qualche secondo e toglie il
 * parametro dall'indirizzo, così tornando indietro o ricaricando la pagina l'evidenziazione non ricompare.
 *
 * - `elementId`: l'id dell'elemento nella pagina per la voce.
 * - `resolve`: facoltativo, prepara la pagina (es. toglie un filtro che nasconderebbe la voce) e restituisce l'id
 *   da segnare, se diverso da quello cercato (es. la parte in corso di una spesa ricorrente divisa).
 */
export function useHighlight(elementId: (id: string) => string, resolve?: (id: string) => string) {
  const route = useRoute()
  const router = useRouter()
  const highlightedId = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(
    () => route.query.highlight,
    (raw) => {
      if (!raw || typeof raw !== 'string') return
      const id = resolve ? resolve(raw) : raw
      highlightedId.value = id
      void nextTick(() => document.getElementById(elementId(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      clearTimeout(timer)
      timer = setTimeout(() => (highlightedId.value = null), HIGHLIGHT_MS)
      const query = { ...route.query }
      delete query.highlight
      void router.replace({ query })
    },
    { immediate: true },
  )
  onBeforeUnmount(() => clearTimeout(timer))

  return highlightedId
}
