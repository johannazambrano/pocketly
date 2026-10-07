<script setup lang="ts">
/** Lista di movimenti con totale in fondo, usata da una tantum / ricorrenti / entrate. */

defineProps<{ empty: boolean; emptyText: string; totalLabel: string; total: string }>()
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <ul class="divide-y divide-slate-100">
      <slot />
      <li v-if="empty" class="p-4 text-center text-xs text-slate-400">{{ emptyText }}</li>
    </ul>
    <div class="flex justify-between border-t border-slate-200 bg-slate-50 p-3 text-sm font-bold">
      <span class="uppercase">{{ totalLabel }}</span>
      <span class="text-emerald-600">{{ total }}</span>
    </div>
  </div>
</template>
