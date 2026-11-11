<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ name: string; amount: string; subtitle?: string; amountClass?: string }>()
const emit = defineEmits<{ edit: []; delete: [] }>()
const { t } = useI18n()
</script>

<template>
  <li class="flex items-center gap-2 p-3">
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-bold text-ink-2">{{ name }}</div>
      <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-4">
        <slot name="meta" />
      </div>
      <div v-if="subtitle" class="mt-0.5 truncate text-[11px] text-ink-5">{{ subtitle }}</div>
    </div>
    <div class="shrink-0 text-right text-sm font-semibold" :class="amountClass">{{ amount }}</div>
    <div class="flex shrink-0">
      <button type="button" class="icon-btn text-xs text-recurring" :aria-label="t('common.edit')" @click="emit('edit')">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button type="button" class="icon-btn text-xs text-negative-light" :aria-label="t('common.delete')" @click="emit('delete')">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  </li>
</template>
