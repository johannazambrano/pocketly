<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ title: string; addLabel?: string }>()
const emit = defineEmits<{ add: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <h2 class="text-lg font-bold text-slate-800">{{ title }}</h2>
    <slot>
      <button v-if="addLabel !== undefined" type="button" class="btn-primary" @click="emit('add')">
        <i class="fa-solid fa-plus mr-1"></i> {{ addLabel || t('app.add') }}
      </button>
    </slot>
  </div>
</template>
