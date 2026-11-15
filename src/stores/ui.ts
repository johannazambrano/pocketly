import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { OneTimeExpense, QuickExpense } from '@/types/models'

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  /** Il pulsante che rinuncia; di serie "Annulla". */
  cancelLabel?: string
  danger: boolean
  resolve: (ok: boolean) => void
}

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'error'
  actions?: ToastAction[]
}

export const useUiStore = defineStore('ui', () => {
  /** Apertura del modulo "nuova spesa" dal pulsante + dell'header o da un inserimento rapido. */
  const quickAddOpen = ref(false)
  const quickAddPreset = ref<QuickExpense | null>(null)
  const quickEditExpense = ref<OneTimeExpense | null>(null)
  const confirmRequest = ref<ConfirmRequest | null>(null)
  const toasts = ref<Toast[]>([])
  let toastSeq = 0

  function openQuickAdd() {
    quickAddPreset.value = null
    quickEditExpense.value = null
    quickAddOpen.value = true
  }

  function openQuickAddFromPreset(preset: QuickExpense) {
    quickEditExpense.value = null
    quickAddPreset.value = preset
    quickAddOpen.value = true
  }

  function openQuickEdit(expense: OneTimeExpense) {
    quickAddPreset.value = null
    quickEditExpense.value = expense
    quickAddOpen.value = true
  }

  function closeQuickAdd() {
    quickAddOpen.value = false
    quickAddPreset.value = null
    quickEditExpense.value = null
  }

  function confirm(options: { title: string; message: string; confirmLabel: string; cancelLabel?: string; danger?: boolean }) {
    return new Promise<boolean>((resolve) => {
      confirmRequest.value?.resolve(false)
      confirmRequest.value = { danger: true, ...options, resolve }
    })
  }

  function answerConfirm(ok: boolean) {
    confirmRequest.value?.resolve(ok)
    confirmRequest.value = null
  }

  const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()
  const startToastTimer = (id: number, ms: number) => {
    clearTimeout(toastTimers.get(id))
    toastTimers.set(id, setTimeout(() => dismissToast(id), ms))
  }

  /**
   * Un messaggio a comparsa. Gli errori e i messaggi con pulsanti (es. «Annulla») restano 10 secondi invece di 3,5:
   * vanno letti con calma o c'è qualcosa da premere. Mentre ci si sta sopra (dito, mouse o tastiera) non spariscono
   * (`holdToast` / `releaseToast`). Si possono chiudere con ✕.
   */
  function toast(message: string, kind: Toast['kind'] = 'success', options?: { actions?: ToastAction[]; durationMs?: number }) {
    const id = ++toastSeq
    const actions = options?.actions
    toasts.value.push({ id, message, kind, ...(actions?.length ? { actions } : {}) })
    const defaultDuration = kind === 'error' || actions?.length ? 10000 : 3500
    startToastTimer(id, options?.durationMs ?? defaultDuration)
  }

  /** Ferma il conto alla rovescia di un messaggio mentre lo si sta usando. */
  function holdToast(id: number) {
    clearTimeout(toastTimers.get(id))
    toastTimers.delete(id)
  }

  /** Riparte il conto alla rovescia quando lo si lascia: qualche secondo per finire di leggere. */
  function releaseToast(id: number) {
    if (toasts.value.some((t) => t.id === id)) startToastTimer(id, 4000)
  }

  function dismissToast(id: number) {
    clearTimeout(toastTimers.get(id))
    toastTimers.delete(id)
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    quickAddOpen,
    quickAddPreset,
    quickEditExpense,
    confirmRequest,
    toasts,
    openQuickAdd,
    openQuickAddFromPreset,
    openQuickEdit,
    closeQuickAdd,
    confirm,
    answerConfirm,
    toast,
    holdToast,
    releaseToast,
    dismissToast,
  }
})
