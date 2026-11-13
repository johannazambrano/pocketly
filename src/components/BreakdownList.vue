<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { TagTotal, TagTrendInfo, Verdict } from '@/domain/calculations'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { useFormat } from '@/i18n'

/** Con `linked` ogni riga porta al dettaglio delle voci che la compongono. */
const props = defineProps<{
  kind: TagKind
  totals: TagTotal[]
  grandTotal: number
  emptyText: string
  linked?: boolean
  trends?: Map<string, TagTrendInfo>
}>()
const finance = useFinanceStore()
const { t, money, percent } = useFormat()

function trendLabel(trend: TagTrendInfo): string {
  const avg = money(trend.previousAverage)
  if (trend.isPace) {
    if (trend.verdict === 'above') return t('dashboard.trendPaceAbove', { average: avg })
    if (trend.verdict === 'below') return t('dashboard.trendPaceBelow', { average: avg })
    return t('dashboard.trendPaceInline', { average: avg })
  }
  if (trend.verdict === 'above') return t('dashboard.trendAbove', { average: avg })
  if (trend.verdict === 'below') return t('dashboard.trendBelow', { average: avg })
  return t('dashboard.trendInline', { average: avg })
}

function trendIcon(verdict: Verdict): string {
  if (verdict === 'above') return 'fa-solid fa-arrow-trend-up'
  if (verdict === 'below') return 'fa-solid fa-arrow-trend-down'
  return 'fa-solid fa-minus'
}

function trendClass(verdict: Verdict): string {
  if (verdict === 'above') return 'bg-caution-soft text-caution'
  if (verdict === 'below') return 'bg-accent-soft text-accent'
  return 'bg-surface-3 text-ink-4'
}

/**
 * Il nome del link letto da un lettore di schermo: nome, importo e quota separati e la destinazione detta, invece del
 * testo attaccato della riga ("Altro857,70 € (60%)"). Se presente, include il confronto con la media precedente.
 */
const rowLabel = (row: TagTotal) => {
  const trend = props.trends?.get(row.id)
  const trendText = trend ? `, ${trendLabel(trend)}` : ''
  return (
    t('dashboard.breakdownRowLabel', {
      name: finance.tag(props.kind, row.id)?.name ?? t('common.unknown'),
      amount: money(row.total),
      percent: percent(row.total / props.grandTotal),
    }) + trendText
  )
}
</script>

<template>
  <!-- Righe cliccabili alte almeno 40px per il dito: lo spazio tra le righe lo dà il loro padding. -->
  <div :class="linked ? 'space-y-0.5' : 'space-y-2'">
    <component
      :is="linked ? RouterLink : 'div'"
      v-for="row in totals"
      :key="row.id"
      v-bind="linked ? { to: `/dettaglio/${kind === 'paymentMethods' ? 'metodo' : 'categoria'}/${row.id}`, 'aria-label': rowLabel(row) } : {}"
      class="block"
      :class="{ '-mx-2 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2': linked }"
    >
      <div class="mb-1 flex items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="truncate font-medium">{{ finance.tag(kind, row.id)?.name ?? t('common.unknown') }}</span>
          <span
            v-if="trends?.get(row.id)"
            class="inline-flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none"
            :class="trendClass(trends.get(row.id)!.verdict)"
            :title="trendLabel(trends.get(row.id)!)"
            :aria-label="trendLabel(trends.get(row.id)!)"
          >
            <i :class="trendIcon(trends.get(row.id)!.verdict)" aria-hidden="true"></i>
          </span>
        </div>
        <span class="flex shrink-0 items-center gap-2 text-ink-4">
          {{ money(row.total) }} ({{ percent(row.total / grandTotal) }})
          <i v-if="linked" class="fa-solid fa-chevron-right text-xs text-ink-5" aria-hidden="true"></i>
        </span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          class="h-full rounded-full"
          :style="{ width: `${(row.total / grandTotal) * 100}%`, backgroundColor: finance.tag(kind, row.id)?.color ?? '#94a3b8' }"
        ></div>
      </div>
    </component>
    <p v-if="!totals.length" class="text-xs text-ink-4">{{ emptyText }}</p>
  </div>
</template>
