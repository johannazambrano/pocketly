<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppearanceStore } from '@/stores/appearance'

defineProps<{ title: string; addLabel?: string }>()
const emit = defineEmits<{ add: [] }>()
const { t } = useI18n()
const appearance = useAppearanceStore()
/**
 * Il titolo della pagina: grande su iPhone (il "large title" di Apple), solo per i lettori di schermo su Android, dove
 * il nome della pagina sta già nella barra in alto, e di misura media sul PC.
 */
const titleClass = {
  ios: 'text-[34px] leading-tight font-bold tracking-tight text-ink',
  android: 'sr-only',
  desktop: 'text-2xl font-bold tracking-tight text-ink',
}
</script>

<template>
  <!-- Se titolo e controlli non stanno su una riga, i controlli vanno sotto invece di uscire dallo schermo. -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h2 :class="titleClass[appearance.platform]">{{ title }}</h2>
    <slot>
      <button v-if="addLabel !== undefined" type="button" class="btn-primary" @click="emit('add')">
        <i class="fa-solid fa-plus mr-1"></i> {{ addLabel || t('app.add') }}
      </button>
    </slot>
  </div>
</template>
