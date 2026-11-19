<script setup lang="ts">
/**
 * Una riga delle liste (variabili, ricorrenti, entrate), con la forma della piattaforma:
 * - sul telefono tutta la riga apre la modifica, come nelle app di sistema, e si elimina dal modulo ("Elimina" in
 *   fondo): su iPhone la freccia › a destra, su Android l'iniziale in un cerchio a sinistra;
 * - sul PC matita e cestino a destra.
 * Sul telefono il pulsante che apre la modifica sta sotto il contenuto e lo copre tutto; il contenuto lascia passare i
 * tocchi (`pointer-events-none`), tranne i suoi pulsanti (i tag che filtrano la lista).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppearanceStore } from '@/stores/appearance'

defineProps<{ name: string; amount: string; subtitle?: string; amountClass?: string; duplicable?: boolean }>()
const emit = defineEmits<{ edit: []; delete: []; duplicate: [] }>()
const { t } = useI18n()
const appearance = useAppearanceStore()
const touch = computed(() => appearance.platform !== 'desktop')

const nameClass = {
  ios: 'text-[15px] font-semibold text-ink',
  android: 'text-base text-ink',
  desktop: 'text-sm font-bold text-ink-2',
}
</script>

<template>
  <li class="relative">
    <button
      v-if="touch"
      type="button"
      class="absolute inset-0 h-full w-full transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2 active:bg-surface-3"
      :aria-label="`${t('common.edit')}: ${name}`"
      @click="emit('edit')"
    ></button>
    <div class="flex items-center gap-3 p-3" :class="{ 'pointer-events-none relative [&_button]:pointer-events-auto': touch }">
      <span
        v-if="appearance.platform === 'android'"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft-2 text-sm font-medium text-accent-strongest"
        aria-hidden="true"
      >
        {{ name.charAt(0).toLocaleUpperCase() }}
      </span>
      <div class="min-w-0 flex-1">
        <div class="truncate" :class="nameClass[appearance.platform]">{{ name }}</div>
        <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-4">
          <slot name="meta" />
        </div>
        <div v-if="subtitle" class="mt-0.5 truncate text-[11px] text-ink-4">{{ subtitle }}</div>
      </div>
      <div class="shrink-0 text-right text-sm font-semibold" :class="amountClass">{{ amount }}</div>
      <i v-if="appearance.platform === 'ios'" class="fa-solid fa-chevron-right shrink-0 text-xs text-ink-5" aria-hidden="true"></i>
      <div v-if="!touch" class="flex shrink-0">
        <button
          v-if="duplicable"
          type="button"
          class="icon-btn text-xs text-ink-3 hover:text-accent"
          :aria-label="t('common.duplicate')"
          :title="t('common.duplicate')"
          @click="emit('duplicate')"
        >
          <i class="fa-solid fa-copy"></i>
        </button>
        <button type="button" class="icon-btn text-xs text-recurring" :aria-label="t('common.edit')" @click="emit('edit')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button type="button" class="icon-btn text-xs text-negative-light" :aria-label="t('common.delete')" @click="emit('delete')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  </li>
</template>
