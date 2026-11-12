import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  /** Il pulsante che rinuncia; di serie "Annulla". */
  cancelLabel?: string
  danger: boolean
  resolve: (ok: boolean) => void
}

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'error'
}

export const useUiStore = defineStore('ui', () => {
  /** Apertura del modulo "nuova spesa" dal pulsante + dell'header. */
  const quickAddOpen = ref(false)
  /** Apertura della finestra di ricerca globale Omnisearch. */
  const searchOpen = ref(false)
  const confirmRequest = ref<ConfirmRequest | null>(null)
  const toasts = ref<Toast[]>([])
  let toastSeq = 0

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

  /**
   * Un messaggio a comparsa. Gli errori restano di più (10 secondi invece di 3,5): spesso spiegano un problema e cosa
   * fare, e vanno letti con calma. Si possono chiudere toccandoli.
   */
  function toast(message: string, kind: Toast['kind'] = 'success') {
    const id = ++toastSeq
    toasts.value.push({ id, message, kind })
    setTimeout(() => dismissToast(id), kind === 'error' ? 10000 : 3500)
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function openSearch() {
    searchOpen.value = true
  }

  function closeSearch() {
    searchOpen.value = false
  }

  return { quickAddOpen, searchOpen, openSearch, closeSearch, confirmRequest, toasts, confirm, answerConfirm, toast, dismissToast }
})
