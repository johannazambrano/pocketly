import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
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
  const confirmRequest = ref<ConfirmRequest | null>(null)
  const toasts = ref<Toast[]>([])
  let toastSeq = 0

  function confirm(options: { title: string; message: string; confirmLabel: string; danger?: boolean }) {
    return new Promise<boolean>((resolve) => {
      confirmRequest.value?.resolve(false)
      confirmRequest.value = { danger: true, ...options, resolve }
    })
  }

  function answerConfirm(ok: boolean) {
    confirmRequest.value?.resolve(ok)
    confirmRequest.value = null
  }

  function toast(message: string, kind: Toast['kind'] = 'success') {
    const id = ++toastSeq
    toasts.value.push({ id, message, kind })
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 3500)
  }

  return { quickAddOpen, confirmRequest, toasts, confirm, answerConfirm, toast }
})
