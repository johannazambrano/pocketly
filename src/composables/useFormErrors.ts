import { nextTick, reactive, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import { amountProblem, toCents } from '@/utils/money'
import type { Cents } from '@/types/models'

/**
 * Gli errori di un modulo, campo per campo: il messaggio sta sotto il campo sbagliato (`FieldError`), il campo si
 * colora (`aria-invalid`) ed è collegato al messaggio (`aria-describedby`), e alla conferma il cursore torna sul primo
 * campo da sistemare. Un errore sparisce appena si cambia il campo. Al posto dei fumetti del browser: i moduli hanno
 * `novalidate` e controllano da sé.
 *
 * `form` è lo stato reattivo del modulo: le chiavi degli errori sono i suoi campi.
 */
export function useFormErrors<F extends object>(form: F) {
  const { t } = useFormat()
  const errors = reactive<Record<string, string | undefined>>({})
  const uid = useId()
  const errorId = (field: keyof F & string) => `${uid}-${field}-error`

  watch(
    () => ({ ...form }) as Record<string, unknown>,
    (now, before) => {
      for (const key of Object.keys(errors)) {
        if (now[key] !== before[key]) delete errors[key]
      }
    },
  )

  function clear() {
    for (const key of Object.keys(errors)) delete errors[key]
  }
  function set(field: keyof F & string, message: string) {
    errors[field] = message
  }
  /** Gli attributi da dare al campo: `data-field` serve a ritrovarlo per il focus. */
  function attrs(field: keyof F & string) {
    const message = errors[field]
    return { 'data-field': field, 'aria-invalid': message ? ('true' as const) : undefined, 'aria-describedby': message ? errorId(field) : undefined }
  }
  /** Controlla un importo e, se non va, scrive il messaggio del suo caso. */
  function amount(field: keyof F & string, raw: string): Cents | null {
    const problem = amountProblem(raw)
    if (problem === 'empty') set(field, t('form.amountEmpty'))
    else if (problem === 'unreadable') set(field, t('form.amountUnreadable', { value: raw.trim() }))
    else if (problem === 'notPositive') set(field, t('form.amountNotPositive'))
    return problem ? null : toCents(raw)
  }
  /** Un campo obbligatorio vuoto. */
  function required(field: keyof F & string, value: string, message: string): boolean {
    if (value.trim() !== '') return true
    set(field, message)
    return false
  }
  const hasErrors = () => Object.values(errors).some(Boolean)
  /** Porta il cursore sul primo campo con un errore, nell'ordine del modulo. */
  async function focusFirst(root: HTMLElement | null | undefined) {
    await nextTick()
    root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }

  return { errors, errorId, attrs, clear, set, amount, required, hasErrors, focusFirst }
}
