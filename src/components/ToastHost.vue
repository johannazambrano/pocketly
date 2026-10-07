<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
    <TransitionGroup enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0" enter-active-class="transition" leave-active-class="transition">
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="rounded-lg px-4 py-2 text-xs font-medium text-white shadow-lg"
        :class="toast.kind === 'error' ? 'bg-rose-600' : 'bg-slate-900'"
      >
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>
