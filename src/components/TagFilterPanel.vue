<script setup lang="ts">
import { ref } from 'vue'
import type { Cents, Id, Tag } from '@/types/models'
import type { ActiveTag, TagBreakdownRow } from '@/composables/useTagFilteredEntries'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { OTHER_COLOR } from '@/utils/colors'

/**
 * Filtro per tag di Spese ed Entrate: barra dei tag dell'anno, riepilogo per tag comprimibile e riquadro del tag
 * scelto con il totale dell'anno. I dati arrivano da `useTagFilteredEntries`.
 */
const props = withDefaults(
  defineProps<{
    section: 'onetime' | 'income'
    tags: ActiveTag[]
    breakdown: TagBreakdownRow[]
    grandTotal: Cents
    selectedTagId: Id | null
    selectedTag: Tag | null
    /** Voci mostrate con il filtro attivo. */
    shownCount: number
    yearCount: number
    yearTotal: Cents
    /** Colore delle cifre nel riepilogo: verde per le entrate. */
    amountClass?: string
  }>(),
  { amountClass: 'text-ink-2' },
)

const emit = defineEmits<{ toggle: [tagId: Id | null] }>()

const finance = useFinanceStore()
const { t, money, percent } = useFormat()
const showBreakdown = ref(false)

const KEYS = {
  onetime: {
    allTags: 'onetime.allTags',
    tagSummary: 'onetime.tagSummary',
    count: 'onetime.expensesCount',
    yearTagTotal: 'onetime.yearTagTotal',
    viewAllYear: 'onetime.viewAllYear',
    clearFilter: 'onetime.clearFilter',
  },
  income: {
    allTags: 'income.allTags',
    tagSummary: 'income.tagSummary',
    count: 'income.incomesCount',
    yearTagTotal: 'income.yearTagTotal',
    viewAllYear: 'income.viewAllYear',
    clearFilter: 'income.clearFilter',
  },
} as const
const k = KEYS[props.section]

const nameOf = (tag: Tag | undefined) => tag?.name ?? t('common.unknown')
const colorOf = (tag: Tag | undefined) => tag?.color ?? OTHER_COLOR
</script>

<template>
  <div v-if="tags.length > 0" class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          type="button"
          class="shrink-0 rounded-full px-3 py-1 font-medium transition-colors"
          :class="
            selectedTagId === null
              ? 'bg-chrome-2 text-on-color shadow-xs'
              : 'bg-surface border border-line text-ink-3 hover:bg-surface-2'
          "
          @click="emit('toggle', null)"
        >
          {{ t(k.allTags) }}
        </button>
        <button
          v-for="item in tags"
          :key="item.id"
          type="button"
          class="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all"
          :class="
            selectedTagId === item.id
              ? 'bg-accent-fill text-on-color shadow-xs'
              : 'bg-surface border border-line text-ink-2 hover:bg-surface-2'
          "
          @click="emit('toggle', item.id)"
        >
          <span
            class="h-2 w-2 rounded-full"
            :class="{ 'bg-on-color': selectedTagId === item.id }"
            :style="selectedTagId === item.id ? undefined : { backgroundColor: colorOf(item.tag) }"
          ></span>
          <span>#{{ nameOf(item.tag) }}</span>
          <span
            class="text-[10px] opacity-75 font-normal"
            :class="selectedTagId === item.id ? 'text-on-color' : 'text-ink-4'"
          >
            ({{ item.countInMonth }})
          </span>
        </button>
      </div>

      <!-- Pulsante toggle riepilogo raggruppato -->
      <button
        v-if="breakdown.length > 0"
        type="button"
        class="shrink-0 inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-3 shadow-2xs hover:bg-surface-2 transition-colors"
        :class="{ 'border-accent-bright text-accent bg-accent-soft': showBreakdown }"
        :title="t(k.tagSummary)"
        @click="showBreakdown = !showBreakdown"
      >
        <i class="fa-solid fa-chart-pie text-[11px]"></i>
        <span class="hidden sm:inline">{{ t(k.tagSummary) }}</span>
      </button>
    </div>

    <!-- Card Riepilogo Raggruppato per Tag (comprimibile) -->
    <div v-if="showBreakdown && breakdown.length > 0" class="card space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-ink-2">
          {{ t(k.tagSummary) }}
        </h3>
        <span class="text-xs text-ink-4">{{ breakdown.length }} tag</span>
      </div>
      <div class="space-y-2">
        <div
          v-for="row in breakdown"
          :key="row.id"
          class="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-surface-2"
          @click="emit('toggle', row.id)"
        >
          <div class="mb-1 flex justify-between gap-2 text-xs">
            <span class="truncate font-medium text-ink-2 flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: colorOf(row.tag) }"></span>
              <span>#{{ nameOf(row.tag) }}</span>
              <span class="text-[10px] text-ink-4">({{ t(k.count, { n: row.count }, row.count) }})</span>
            </span>
            <span class="shrink-0 font-semibold" :class="amountClass">
              {{ money(row.total) }}
              <span class="font-normal text-ink-4">({{ percent(row.total / grandTotal) }})</span>
            </span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              class="h-full rounded-full transition-all"
              :style="{ width: `${(row.total / grandTotal) * 100}%`, backgroundColor: colorOf(row.tag) }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Banner Informativo Tag Attivo (con totale dell'anno, es. una vacanza tra due mesi) -->
    <div
      v-if="selectedTag"
      class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent-line bg-accent-soft/80 p-3 text-xs text-accent-strongest shadow-2xs"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span class="h-2.5 w-2.5 rounded-full shrink-0" :style="{ backgroundColor: selectedTag.color }"></span>
        <div class="min-w-0">
          <div class="font-bold truncate">
            #{{ selectedTag.name }}
            <span class="font-normal text-accent ml-1">
              ({{ t(k.count, { n: shownCount }, shownCount) }})
            </span>
          </div>
          <div v-if="finance.selectedMonth !== 'all' && yearCount > shownCount" class="text-[11px] text-accent mt-0.5">
            {{ t(k.yearTagTotal, { tag: selectedTag.name, amount: money(yearTotal) }) }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 ml-auto shrink-0">
        <button
          v-if="finance.selectedMonth !== 'all' && yearCount > shownCount"
          type="button"
          class="rounded-md bg-surface px-2 py-1 text-[11px] font-semibold text-accent-strong shadow-2xs hover:bg-accent-soft-2 transition-colors"
          @click="finance.selectedMonth = 'all'"
        >
          {{ t(k.viewAllYear) }}
        </button>
        <button
          type="button"
          class="rounded-md bg-accent-line/60 px-2 py-1 text-[11px] font-semibold text-accent-stronger hover:bg-accent-line transition-colors"
          @click="emit('toggle', null)"
        >
          {{ t(k.clearFilter) }}
        </button>
      </div>
    </div>
  </div>
</template>
