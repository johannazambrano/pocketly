<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppearanceStore } from '@/stores/appearance'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const appearance = useAppearanceStore()
const { t } = useI18n()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
    :class="
      appearance.platform === 'android'
        ? 'bottom-[calc(10rem+env(safe-area-inset-bottom))]'
        : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] max-[379px]:bottom-[calc(9.5rem+env(safe-area-inset-bottom))]'
    "
    aria-live="polite"
  >
    <TransitionGroup enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0" enter-active-class="transition" leave-active-class="transition">
      <!-- Errori e messaggi con pulsanti hanno la ✕: restano a lungo e non devono coprire la pagina più del necessario. -->
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="flex max-w-md flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg px-4 py-2.5 text-sm font-medium text-on-color shadow-lg"
        :class="[
          toast.kind === 'error' ? 'pointer-events-auto bg-negative-fill-strong' : 'bg-chrome',
          toast.actions?.length ? 'pointer-events-auto' : '',
        ]"
        :role="toast.kind === 'error' ? 'alert' : undefined"
        @pointerenter="ui.holdToast(toast.id)"
        @pointerleave="ui.releaseToast(toast.id)"
        @focusin="ui.holdToast(toast.id)"
        @focusout="ui.releaseToast(toast.id)"
      >
        <span class="min-w-0 flex-1">{{ toast.message }}</span>
        <div v-if="toast.actions?.length" class="flex shrink-0 items-center gap-1.5">
          <button
            v-for="action in toast.actions"
            :key="action.label"
            type="button"
            class="min-h-10 rounded-md bg-on-color/15 px-2.5 py-1 text-xs font-semibold text-on-color transition hover:bg-on-color/25"
            @click="action.onClick(); ui.dismissToast(toast.id)"
          >
            {{ action.label }}
          </button>
        </div>
        <button
          v-if="toast.kind === 'error' || toast.actions?.length"
          type="button"
          class="-my-1 -mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-on-color/15"
          :aria-label="t('common.close')"
          @click="ui.dismissToast(toast.id)"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
