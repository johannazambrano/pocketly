<script setup lang="ts">
/**
 * I pulsanti in fondo ai moduli, con la forma della piattaforma:
 * - iPhone: niente, perché Annulla e Fine stanno nella barra del foglio (vedi `BaseModal`, prop `formId`);
 * - Android: "Annulla" come pulsante di testo e "Salva" pieno a pillola, allineati a destra (Material 3);
 * - PC: "Annulla" e "Salva" a tutta larghezza.
 */
import { useAppearanceStore } from '@/stores/appearance'

defineProps<{ label: string; cancelLabel?: string }>()
const emit = defineEmits<{ cancel: [] }>()
const appearance = useAppearanceStore()
</script>

<template>
  <div v-if="appearance.platform === 'android'" class="flex justify-end gap-2 pt-2">
    <button
      v-if="cancelLabel"
      type="button"
      class="h-10 rounded-full px-4 text-sm font-medium text-accent transition hover:bg-accent-soft"
      @click="emit('cancel')"
    >
      {{ cancelLabel }}
    </button>
    <button type="submit" class="h-10 rounded-full bg-accent-fill px-6 text-sm font-medium text-on-color transition hover:bg-accent-fill-strong">
      {{ label }}
    </button>
  </div>
  <div v-else-if="appearance.platform === 'desktop'" class="pt-2" :class="cancelLabel ? 'grid grid-cols-[1fr_2fr] gap-2' : ''">
    <button
      v-if="cancelLabel"
      type="button"
      class="w-full rounded-xl border border-line-strong bg-surface py-3 text-sm font-medium text-ink-2 transition hover:bg-surface-2"
      @click="emit('cancel')"
    >
      {{ cancelLabel }}
    </button>
    <button type="submit" class="w-full rounded-xl bg-accent-fill py-3 text-sm font-bold text-on-color shadow transition hover:bg-accent-fill-strong active:bg-accent-fill-stronger">
      {{ label }}
    </button>
  </div>
</template>
