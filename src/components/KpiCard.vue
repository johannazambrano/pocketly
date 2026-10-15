<script setup lang="ts">
defineProps<{ label: string; value: string; color: string; hint?: string }>()
</script>

<template>
  <div class="card">
    <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{{ label }}</p>
    <p class="mt-1 truncate text-lg font-bold" :class="color">{{ value }}</p>
    <p v-if="hint" class="mt-0.5 text-[11px] leading-tight text-slate-400">{{ hint }}</p>
  </div>
</template>
