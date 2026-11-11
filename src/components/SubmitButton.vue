<script setup lang="ts">
/**
 * Il pulsante principale dei moduli. Con `cancelLabel` compare accanto un "Annulla" esplicito: la ✕ in alto non basta
 * a dire che si può uscire senza salvare.
 */
defineProps<{ label: string; cancelLabel?: string }>()
const emit = defineEmits<{ cancel: [] }>()
</script>

<template>
  <div :class="cancelLabel ? 'grid grid-cols-[1fr_2fr] gap-2' : ''">
    <button
      v-if="cancelLabel"
      type="button"
      class="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      @click="emit('cancel')"
    >
      {{ cancelLabel }}
    </button>
    <button type="submit" class="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow transition hover:bg-emerald-800 active:bg-emerald-900">
      {{ label }}
    </button>
  </div>
</template>
