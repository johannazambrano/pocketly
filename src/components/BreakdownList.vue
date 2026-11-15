<script setup lang="ts">
import { OTHER_COLOR } from '@/utils/colors'
import { RouterLink } from 'vue-router'
import type { TagTotal, TagTrendInfo } from '@/domain/calculations'
import { useTrendText } from '@/composables/useTrendText'
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
const trendText = useTrendText()

/** Il confronto da mostrare sulla riga: solo se la spesa è sopra o sotto il solito («in linea» non aggiunge niente). */
const shownTrend = (id: string) => {
  const trend = props.trends?.get(id)
  return trend && trend.verdict !== 'inline' ? trend : null
}

/**
 * Il nome del link letto da un lettore di schermo: nome, importo, quota e l'eventuale trend, con la destinazione
 * ("vedi le voci") sempre al termine della frase.
 */
const rowLabel = (row: TagTotal) => {
  const trend = props.trends?.get(row.id)
  const name = finance.tag(props.kind, row.id)?.name ?? t('common.unknown')
  const amount = money(row.total)
  const percentStr = percent(row.total / props.grandTotal)
  if (trend) {
    return t('dashboard.breakdownRowLabelWithTrend', {
      name,
      amount,
      percent: percentStr,
      trend: trendText.label(trend),
    })
  }
  return t('dashboard.breakdownRowLabel', {
    name,
    amount,
    percent: percentStr,
  })
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
        </div>
        <span class="flex shrink-0 items-center gap-2 text-ink-4">
          {{ money(row.total) }} ({{ percent(row.total / grandTotal) }})
          <i v-if="linked" class="fa-solid fa-chevron-right text-xs text-ink-5" aria-hidden="true"></i>
        </span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          class="h-full rounded-full"
          :style="{ width: `${(row.total / grandTotal) * 100}%`, backgroundColor: finance.tag(kind, row.id)?.color ?? OTHER_COLOR }"
        ></div>
      </div>
      <p
        v-if="shownTrend(row.id)"
        class="mt-1 flex items-center gap-1 text-[11px] font-medium"
        :class="trendText.textTone(shownTrend(row.id)!.verdict)"
      >
        <i :class="trendText.icon(shownTrend(row.id)!.verdict)" aria-hidden="true"></i>
        {{ t(shownTrend(row.id)!.verdict === 'above' ? 'dashboard.trendShortAbove' : 'dashboard.trendShortBelow') }}
      </p>
    </component>
    <p v-if="!totals.length" class="text-xs text-ink-4">{{ emptyText }}</p>
  </div>
</template>
