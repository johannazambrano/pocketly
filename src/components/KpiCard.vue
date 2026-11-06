<script setup lang="ts">
defineProps<{ label: string; value: string; color: string; hint?: string }>()
</script>

<template>
  <div class="card">
    <p class="text-xs font-medium text-balance text-slate-500">{{ label }}</p>
    <p class="mt-1 text-lg font-bold whitespace-nowrap" :class="color">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs leading-snug whitespace-pre-line text-slate-400">{{ hint }}</p>
  </div>
</template>
