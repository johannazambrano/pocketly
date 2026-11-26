/**
 * Copia profonda di un valore fatto solo di dati JSON (oggetti, array, stringhe, numeri, booleani, null).
 * Toglie i proxy reattivi di Vue prima di salvare in IndexedDB, che non li sa clonare.
 * Un solo punto da cambiare se si passa a `structuredClone(toRaw(...))` (PKT-18).
 */
export function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
