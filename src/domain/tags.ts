import type { Tag } from '@/types/models'

/**
 * Categorie, metodi di pagamento o tag in ordine alfabetico, come si leggono nei menu: segue la lingua dell'app
 * (`locale`, es. `it-IT`), non bada a maiuscole e accenti («ristorante» accanto a «Ristorante», «è» con «e») e
 * mette i numeri nel loro ordine («Carta 2» prima di «Carta 10»). A parità di nome resta l'ordine di creazione.
 * Restituisce un elenco nuovo: i dati salvati restano com'erano.
 */
export function sortTagsByName<T extends Pick<Tag, 'name'>>(tags: readonly T[], locale: string): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  return [...tags].sort((a, b) => collator.compare(a.name.trim(), b.name.trim()))
}
