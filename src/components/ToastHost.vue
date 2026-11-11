<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { t } = useI18n()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
    <TransitionGroup enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0" enter-active-class="transition" leave-active-class="transition">
      <!-- Gli errori si chiudono toccandoli: restano a lungo e non devono coprire la pagina più del necessario. -->
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="flex max-w-md items-start gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        :class="toast.kind === 'error' ? 'pointer-events-auto bg-rose-700' : 'bg-slate-900'"
        :role="toast.kind === 'error' ? 'alert' : undefined"
      >
        <span>{{ toast.message }}</span>
        <button
          v-if="toast.kind === 'error'"
          type="button"
          class="-my-1 -mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
          :aria-label="t('common.close')"
          @click="ui.dismissToast(toast.id)"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
