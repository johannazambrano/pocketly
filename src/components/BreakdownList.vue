<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { TagTotal } from '@/domain/calculations'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { useFormat } from '@/i18n'

/** Con `linked` ogni riga porta al dettaglio delle voci che la compongono. */
defineProps<{ kind: TagKind; totals: TagTotal[]; grandTotal: number; emptyText: string; linked?: boolean }>()
const finance = useFinanceStore()
const { t, money, percent } = useFormat()
</script>

<template>
  <!-- Righe cliccabili alte almeno 40px per il dito: lo spazio tra le righe lo dà il loro padding. -->
  <div :class="linked ? 'space-y-0.5' : 'space-y-2'">
    <component
      :is="linked ? RouterLink : 'div'"
      v-for="row in totals"
      :key="row.id"
      v-bind="linked ? { to: `/dettaglio/${kind === 'paymentMethods' ? 'metodo' : 'categoria'}/${row.id}` } : {}"
      class="block"
      :class="{ '-mx-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50': linked }"
    >
      <div class="mb-1 flex items-center justify-between gap-2 text-xs">
        <span class="truncate font-medium">{{ finance.tag(kind, row.id)?.name ?? t('common.unknown') }}</span>
        <span class="flex shrink-0 items-center gap-2 text-slate-500">
          {{ money(row.total) }} ({{ percent(row.total / grandTotal) }})
          <i v-if="linked" class="fa-solid fa-chevron-right text-xs text-slate-400" aria-hidden="true"></i>
        </span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full"
          :style="{ width: `${(row.total / grandTotal) * 100}%`, backgroundColor: finance.tag(kind, row.id)?.color ?? '#94a3b8' }"
        ></div>
      </div>
    </component>
    <p v-if="!totals.length" class="text-xs text-slate-500">{{ emptyText }}</p>
  </div>
</template>
