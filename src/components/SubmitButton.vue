<script setup lang="ts">
/**
 * I pulsanti in fondo ai moduli, con la forma della piattaforma:
 * - iPhone: Annulla e Fine stanno nella barra del foglio (vedi `BaseModal`, prop `formId`); qui resta solo
 *   "Elimina", come riga rossa a tutta larghezza (come nelle app Apple);
 * - Android: "Elimina" di testo a sinistra, "Annulla" di testo e "Salva" pieno a pillola a destra (Material 3);
 * - PC: "Annulla" e "Salva" a tutta larghezza, "Elimina" sotto.
 * "Elimina" compare solo con `deleteLabel` (modifica di una voce esistente) ed emette `delete`: la conferma la chiede
 * la pagina.
 */
import { useAppearanceStore } from '@/stores/appearance'

defineProps<{ label: string; cancelLabel?: string; deleteLabel?: string }>()
const emit = defineEmits<{ cancel: []; delete: [] }>()
const appearance = useAppearanceStore()
</script>

<template>
  <button
    v-if="appearance.platform === 'ios' && deleteLabel"
    type="button"
    class="mt-3 w-full rounded-[10px] py-3 text-[17px] text-negative"
    :class="appearance.theme === 'dark' ? 'bg-surface-3' : 'bg-surface'"
    @click="emit('delete')"
  >
    {{ deleteLabel }}
  </button>
  <div v-else-if="appearance.platform === 'android'" class="flex items-center gap-2 pt-2">
    <button
      v-if="deleteLabel"
      type="button"
      class="-ml-3 h-10 rounded-full px-3 text-sm font-medium text-negative transition hover:bg-negative-soft"
      @click="emit('delete')"
    >
      {{ deleteLabel }}
    </button>
    <span class="flex-1"></span>
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
  <div v-else-if="appearance.platform === 'desktop'" class="space-y-2 pt-2">
    <div :class="cancelLabel ? 'grid grid-cols-[1fr_2fr] gap-2' : ''">
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
    <button
      v-if="deleteLabel"
      type="button"
      class="w-full rounded-xl py-2 text-sm font-medium text-negative transition hover:bg-negative-soft"
      @click="emit('delete')"
    >
      <i class="fa-solid fa-trash mr-1.5 text-xs" aria-hidden="true"></i>{{ deleteLabel }}
    </button>
  </div>
</template>
