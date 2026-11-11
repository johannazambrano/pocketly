<script setup lang="ts">
/** Lista di movimenti con totale in fondo, usata da una tantum / ricorrenti / entrate. */

defineProps<{ empty: boolean; emptyText: string; totalLabel: string; total: string }>()
</script>

<template>
  <div class="panel">
    <ul class="divide-y divide-line-soft">
      <slot />
      <li v-if="empty" class="p-4 text-center text-xs text-ink-4">{{ emptyText }}</li>
    </ul>
    <div class="flex justify-between border-t border-line bg-surface-2 p-3 text-sm font-bold">
      <span>{{ totalLabel }}</span>
      <span class="text-accent">{{ total }}</span>
    </div>
  </div>
</template>
