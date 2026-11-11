<script lang="ts">
/**
 * Finché una finestra è aperta, il resto dell'app è inerte: non si raggiunge con Tab né con il lettore di schermo, e
 * il focus non può finire dietro lo sfondo scuro. Le finestre possono sovrapporsi (una conferma sopra un modulo):
 * il contatore, condiviso da tutte le finestre, tiene inerte l'app finché non si chiude l'ultima. Le finestre stesse
 * stanno fuori da #app (Teleport), quindi restano usabili.
 */
let openCount = 0
function setAppInert(on: boolean) {
  const app = document.getElementById('app')
  if (app) app.inert = on
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const dialog = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)
const titleId = useId()

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tab e Maiusc+Tab girano dentro la finestra; Esc la chiude. */
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !dialog.value) return
  const items = [...dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  if (e.shiftKey && (active === first || !dialog.value.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !dialog.value.contains(active))) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * All'apertura il focus va sul titolo della finestra: il lettore di schermo annuncia dove si è, e sul telefono non si
 * apre la tastiera da sola. Alla chiusura torna sull'elemento da cui si era aperta, se c'è ancora.
 */
let opener: HTMLElement | null = null
let isOpen = false
async function onOpen() {
  isOpen = true
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  openCount++
  setAppInert(true)
  await nextTick()
  heading.value?.focus()
}
function onClose() {
  if (!isOpen) return
  isOpen = false
  document.removeEventListener('keydown', onKey)
  openCount = Math.max(0, openCount - 1)
  if (openCount === 0) {
    document.body.style.overflow = ''
    setAppInert(false)
  }
  const target = opener
  opener = null
  if (target?.isConnected) target.focus()
}

watch(
  () => props.open,
  (open) => (open ? onOpen() : onClose()),
  { immediate: true },
)

onBeforeUnmount(onClose)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition duration-150"
      leave-active-class="transition duration-150"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <div
          ref="dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          class="pb-safe max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-xl"
        >
          <div class="p-5">
            <div class="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 :id="titleId" ref="heading" tabindex="-1" class="text-base font-bold text-slate-800 focus:outline-none">{{ title }}</h3>
              <!-- Slate 500: un'icona che serve a qualcosa deve stare almeno a 3:1 sul bianco (slate 400 era 2,6:1). -->
              <button type="button" class="icon-btn text-slate-500 hover:text-slate-700" :aria-label="t('common.close')" @click="emit('close')">
                <i class="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
              </button>
            </div>
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
