<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ title: string; addLabel?: string }>()
const emit = defineEmits<{ add: [] }>()
const { t } = useI18n()
</script>

<template>
  <!-- Se titolo e controlli non stanno su una riga, i controlli vanno sotto invece di uscire dallo schermo. -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-lg font-bold text-ink">{{ title }}</h2>
    <slot>
      <button v-if="addLabel !== undefined" type="button" class="btn-primary" @click="emit('add')">
        <i class="fa-solid fa-plus mr-1"></i> {{ addLabel || t('app.add') }}
      </button>
    </slot>
  </div>
</template>
