<script lang="ts">
/**
 * Finché una finestra è aperta, il resto dell'app è inerte: non si raggiunge con Tab né con il lettore di schermo, e
 * il focus non può finire dietro lo sfondo scuro. Le finestre possono sovrapporsi (una conferma sopra un modulo):
 * il contatore, condiviso da tutte le finestre, tiene inerte l'app finché non si chiude l'ultima. Le finestre stesse
 * stanno fuori da #app (Teleport), quindi restano usabili.
 */
let openCount = 0
/** Le finestre aperte, dall'ultima in cima: solo quella in cima risponde a Esc e tiene il Tab. */
const stack: symbol[] = []
function setAppInert(on: boolean) {
  const app = document.getElementById('app')
  if (app) app.inert = on
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useAppearanceStore } from '@/stores/appearance'

/**
 * `dirty`: il modulo dentro ha modifiche non salvate; chiudendo con Esc, ✕ o lo sfondo si chiede prima conferma.
 * `formId`: l'id del modulo dentro la finestra. Su iPhone la barra del foglio diventa "Annulla · titolo · Fine", con
 * Fine che invia quel modulo (come nelle app Apple); su Android il ✕ sparisce perché "Annulla" sta in fondo al modulo.
 */
/**
 * `initialFocus`: selettore del campo da cui partire all'apertura invece del titolo (l'importo di una spesa nuova:
 * chi registra al volo scrive subito, con la tastiera già aperta).
 */
const props = defineProps<{ open: boolean; title: string; dirty?: boolean; formId?: string; initialFocus?: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const ui = useUiStore()
const appearance = useAppearanceStore()
const me = Symbol('modal')
/**
 * Ogni finestra si apre sopra quelle già aperte (una conferma sopra un modulo): il livello cresce con la pila. Senza,
 * a parità di livello vince l'ordine nella pagina, e la conferma poteva finire nascosta dietro il modulo.
 */
const layer = ref(50)

/**
 * Chiusura "di passaggio" (Esc, ✕, tocco sullo sfondo): se ci sono modifiche non salvate si chiede prima, perché un
 * tocco sbagliato sul telefono non deve buttare quello che si è scritto. "Annulla" nel modulo resta una scelta
 * esplicita e chiude subito (anche quello nella barra del foglio su iPhone).
 */
async function requestClose() {
  if (props.dirty) {
    const ok = await ui.confirm({
      title: t('common.discardTitle'),
      message: t('common.discardMessage'),
      confirmLabel: t('common.discardConfirm'),
      cancelLabel: t('common.discardKeep'),
      danger: true,
    })
    if (!ok) return
  }
  emit('close')
}

const dialog = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)
const titleId = useId()

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tab e Maiusc+Tab girano dentro la finestra; Esc la chiude. */
function onKey(e: KeyboardEvent) {
  if (stack[stack.length - 1] !== me) return
  if (e.key === 'Escape') {
    void requestClose()
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
 * apre la tastiera da sola. Con `initialFocus` va invece su quel campo (la finestra si annuncia comunque con il suo
 * nome, da `aria-labelledby`). Alla chiusura torna sull'elemento da cui si era aperta, se c'è ancora.
 */
let opener: HTMLElement | null = null
let isOpen = false
async function onOpen() {
  isOpen = true
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  openCount++
  stack.push(me)
  layer.value = 50 + stack.length
  setAppInert(true)
  await nextTick()
  const field = props.initialFocus ? dialog.value?.querySelector<HTMLElement>(props.initialFocus) : null
  ;(field ?? heading.value)?.focus()
}
function onClose() {
  if (!isOpen) return
  isOpen = false
  document.removeEventListener('keydown', onKey)
  openCount = Math.max(0, openCount - 1)
  const at = stack.indexOf(me)
  if (at >= 0) stack.splice(at, 1)
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
        class="fixed inset-0 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        :style="{ zIndex: layer }"
        @click.self="requestClose"
      >
        <div
          ref="dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          class="sheet pb-safe max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain shadow-xl sm:max-w-lg"
          :class="{
            'rounded-t-xl bg-canvas sm:rounded-xl': appearance.platform === 'ios',
            'rounded-t-[28px] bg-surface sm:rounded-[28px]': appearance.platform === 'android',
            'rounded-t-2xl bg-surface sm:rounded-xl': appearance.platform === 'desktop',
          }"
        >
          <!-- Telefono: la maniglia in cima al foglio, come in iOS e Android. -->
          <div v-if="appearance.platform !== 'desktop'" class="flex justify-center pt-2 sm:hidden" aria-hidden="true">
            <span class="h-1.5 w-9 rounded-full bg-ink-6/60"></span>
          </div>
          <div :class="appearance.platform === 'desktop' ? 'p-5' : 'px-4 pt-2 pb-5'">
            <!-- iPhone con un modulo: Annulla · titolo · Fine, Fine invia il modulo. -->
            <div v-if="appearance.platform === 'ios' && formId" class="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <!-- "Annulla" è una scelta esplicita come quello in fondo ai moduli: chiude subito, senza chiedere. -->
              <button type="button" class="justify-self-start py-2 text-[17px] text-accent" @click="emit('close')">{{ t('common.cancel') }}</button>
              <h3 :id="titleId" ref="heading" tabindex="-1" class="truncate text-center text-[17px] font-semibold text-ink focus:outline-none">{{ title }}</h3>
              <button type="submit" :form="formId" class="justify-self-end py-2 text-[17px] font-semibold text-accent">{{ t('common.done') }}</button>
            </div>
            <div
              v-else
              class="mb-3 flex items-center justify-between gap-2"
              :class="{ 'border-b border-line pb-2': appearance.platform === 'desktop' }"
            >
              <h3
                :id="titleId"
                ref="heading"
                tabindex="-1"
                class="text-ink focus:outline-none"
                :class="{
                  'text-[17px] font-semibold': appearance.platform === 'ios',
                  'text-[22px] leading-7': appearance.platform === 'android',
                  'text-base font-bold': appearance.platform === 'desktop',
                }"
              >
                {{ title }}
              </h3>
              <!-- Slate 500: un'icona che serve a qualcosa deve stare almeno a 3:1 sul bianco (slate 400 era 2,6:1). -->
              <button
                v-if="!(appearance.platform === 'android' && formId)"
                type="button"
                class="icon-btn text-ink-4 hover:text-ink-2"
                :aria-label="t('common.close')"
                @click="requestClose"
              >
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
