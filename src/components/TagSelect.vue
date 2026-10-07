<script setup lang="ts">
import { useFinanceStore, type TagKind } from '@/stores/finance'

defineProps<{ kind: TagKind; label: string }>()
const model = defineModel<string>({ required: true })
const finance = useFinanceStore()
</script>

<template>
  <label class="block">
    <span class="field-label">{{ label }}</span>
    <select v-model="model" required class="field">
      <option v-for="tag in finance.data[kind]" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
    </select>
  </label>
</template>
