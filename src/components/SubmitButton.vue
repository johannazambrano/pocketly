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
      class="w-full rounded-xl border border-line-strong bg-surface py-3 text-sm font-medium text-ink-2 transition hover:bg-surface-2"
      @click="emit('cancel')"
    >
      {{ cancelLabel }}
    </button>
    <button type="submit" class="w-full rounded-xl bg-accent py-3 text-sm font-bold text-on-color shadow transition hover:bg-accent-strong active:bg-accent-stronger">
      {{ label }}
    </button>
  </div>
</template>
