<script setup lang="ts">
import type { TagTotal } from '@/domain/calculations'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { useFormat } from '@/i18n'

defineProps<{ kind: TagKind; totals: TagTotal[]; grandTotal: number; emptyText: string }>()
const finance = useFinanceStore()
const { t, money, percent } = useFormat()
</script>

<template>
  <div class="space-y-2">
    <div v-for="row in totals" :key="row.id">
      <div class="mb-1 flex justify-between gap-2 text-xs">
        <span class="truncate font-medium">{{ finance.tag(kind, row.id)?.name ?? t('common.unknown') }}</span>
        <span class="shrink-0 text-slate-500">{{ money(row.total) }} ({{ percent(row.total / grandTotal) }})</span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full"
          :style="{ width: `${(row.total / grandTotal) * 100}%`, backgroundColor: finance.tag(kind, row.id)?.color ?? '#94a3b8' }"
        ></div>
      </div>
    </div>
    <p v-if="!totals.length" class="text-xs text-slate-400">{{ emptyText }}</p>
  </div>
</template>
