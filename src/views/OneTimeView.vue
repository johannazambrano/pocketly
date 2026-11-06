<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OneTimeExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { oneTimeTagBreakdown } from '@/domain/calculations'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import MonthSelector from '@/components/MonthSelector.vue'

const finance = useFinanceStore()
const { t, money, date, month, locale, percent } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<OneTimeExpense | null>(null)
const selectedTagId = ref<string | null>(null)
const showBreakdown = ref(false)

const selectedTag = computed(() => (selectedTagId.value ? finance.tag('tags', selectedTagId.value) : null))

// Spese filtrate per mese e, se selezionato, per tag
const displayedExpenses = computed(() => {
  if (!selectedTagId.value) return finance.oneTimeFiltered
  return finance.oneTimeFiltered.filter((e) => e.tagIds?.includes(selectedTagId.value!))
})

const total = computed(() => displayedExpenses.value.reduce((acc, e) => acc + e.amount, 0))

// Totale e conteggio per il tag attivo sull'intero anno (utile per vacanze tra mesi diversi)
const yearTotalForSelectedTag = computed(() => {
  if (!selectedTagId.value) return 0
  return finance.oneTimeOfYear
    .filter((e) => e.tagIds?.includes(selectedTagId.value!))
    .reduce((acc, e) => acc + e.amount, 0)
})

const yearCountForSelectedTag = computed(() => {
  if (!selectedTagId.value) return 0
  return finance.oneTimeOfYear.filter((e) => e.tagIds?.includes(selectedTagId.value!)).length
})

// Ripartizione dei tag nel periodo filtrato (e sull'anno)
const tagBreakdown = computed(() => oneTimeTagBreakdown(finance.oneTimeFiltered))
const grandTotalForBreakdown = computed(() => finance.oneTimeFiltered.reduce((acc, e) => acc + e.amount, 0) || 1)

// Tag visibili nella barra dei filtri: tutti quelli che hanno spese nell'anno corrente
const activeYearTags = computed(() => {
  const breakdown = oneTimeTagBreakdown(finance.oneTimeOfYear)
  return breakdown.map((item) => {
    const tag = finance.tag('tags', item.id)
    return {
      id: item.id,
      name: tag?.name ?? t('common.unknown'),
      color: tag?.color ?? '#94a3b8',
      countInMonth: displayedExpensesCountForTag(item.id),
      totalInYear: item.total,
    }
  })
})

function displayedExpensesCountForTag(tagId: string): number {
  return finance.oneTimeFiltered.filter((e) => e.tagIds?.includes(tagId)).length
}

function toggleTagFilter(tagId: string | null) {
  if (selectedTagId.value === tagId) {
    selectedTagId.value = null
  } else {
    selectedTagId.value = tagId
  }
}

const emptyText = computed(() => {
  if (selectedTag.value) {
    return t('onetime.emptyTag', { tag: selectedTag.value.name })
  }
  if (finance.selectedMonth === 'all') return t('onetime.empty')
  const name = month(finance.selectedMonth)
  return t('onetime.emptyMonth', { month: locale.value === 'it' ? name.toLocaleLowerCase('it') : name })
})

const totalLabel = computed(() => {
  if (selectedTag.value) {
    return `${t('common.total')} (#${selectedTag.value.name})`
  }
  return t('common.total')
})

function open(item: OneTimeExpense | null) {
  editing.value = item
  formOpen.value = true
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('onetime.title')">
      <div class="flex flex-wrap items-center justify-end gap-2">
        <MonthSelector />
        <button type="button" class="btn-primary" @click="open(null)">
          <i class="fa-solid fa-plus mr-1"></i> {{ t('app.add') }}
        </button>
      </div>
    </PageHeader>

    <!-- Barra Filtri per Tag (visibile se ci sono tag con spese nell'anno) -->
    <div v-if="activeYearTags.length > 0" class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            class="shrink-0 rounded-full px-3 py-1 font-medium transition-colors"
            :class="
              selectedTagId === null
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            "
            @click="toggleTagFilter(null)"
          >
            {{ t('onetime.allTags') }}
          </button>
          <button
            v-for="item in activeYearTags"
            :key="item.id"
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all"
            :class="
              selectedTagId === item.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            "
            @click="toggleTagFilter(item.id)"
          >
            <span
              class="h-2 w-2 rounded-full"
              :style="{ backgroundColor: selectedTagId === item.id ? '#ffffff' : item.color }"
            ></span>
            <span>#{{ item.name }}</span>
            <span
              class="text-[10px] opacity-75 font-normal"
              :class="selectedTagId === item.id ? 'text-white' : 'text-slate-400'"
            >
              ({{ item.countInMonth }})
            </span>
          </button>
        </div>

        <!-- Pulsante toggle riepilogo raggruppato -->
        <button
          v-if="tagBreakdown.length > 0"
          type="button"
          class="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors"
          :class="{ 'border-emerald-500 text-emerald-700 bg-emerald-50': showBreakdown }"
          :title="t('onetime.tagSummary')"
          @click="showBreakdown = !showBreakdown"
        >
          <i class="fa-solid fa-chart-pie text-[11px]"></i>
          <span class="hidden sm:inline">{{ t('onetime.tagSummary') }}</span>
        </button>
      </div>

      <!-- Card Riepilogo Raggruppato per Tag (comprimibile) -->
      <div v-if="showBreakdown && tagBreakdown.length > 0" class="card space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {{ t('onetime.tagSummary') }}
          </h3>
          <span class="text-xs text-slate-400">{{ tagBreakdown.length }} tag</span>
        </div>
        <div class="space-y-2">
          <div
            v-for="row in tagBreakdown"
            :key="row.id"
            class="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-slate-50"
            @click="toggleTagFilter(row.id)"
          >
            <div class="mb-1 flex justify-between gap-2 text-xs">
              <span class="truncate font-medium text-slate-700 flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: finance.tag('tags', row.id)?.color ?? '#94a3b8' }"></span>
                <span>#{{ finance.tag('tags', row.id)?.name ?? t('common.unknown') }}</span>
                <span class="text-[10px] text-slate-400">({{ t('onetime.expensesCount', { n: row.count }, row.count) }})</span>
              </span>
              <span class="shrink-0 font-semibold text-slate-700">
                {{ money(row.total) }}
                <span class="font-normal text-slate-400">({{ percent(row.total / grandTotalForBreakdown) }})</span>
              </span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all"
                :style="{
                  width: `${(row.total / grandTotalForBreakdown) * 100}%`,
                  backgroundColor: finance.tag('tags', row.id)?.color ?? '#94a3b8',
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Banner Informativo Tag Attivo (con totale anno / vacanza completa tra mesi) -->
      <div
        v-if="selectedTag"
        class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 shadow-2xs"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="h-2.5 w-2.5 rounded-full shrink-0" :style="{ backgroundColor: selectedTag.color }"></span>
          <div class="min-w-0">
            <div class="font-bold truncate">
              #{{ selectedTag.name }}
              <span class="font-normal text-emerald-700 ml-1">
                ({{ t('onetime.expensesCount', { n: displayedExpenses.length }, displayedExpenses.length) }})
              </span>
            </div>
            <div v-if="finance.selectedMonth !== 'all' && yearCountForSelectedTag > displayedExpenses.length" class="text-[11px] text-emerald-700 mt-0.5">
              {{ t('onetime.yearTagTotal', { tag: selectedTag.name, amount: money(yearTotalForSelectedTag) }) }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 ml-auto shrink-0">
          <button
            v-if="finance.selectedMonth !== 'all' && yearCountForSelectedTag > displayedExpenses.length"
            type="button"
            class="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors"
            @click="finance.selectedMonth = 'all'"
          >
            {{ t('onetime.viewAllYear') }}
          </button>
          <button
            type="button"
            class="rounded-md bg-emerald-200/60 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-200 transition-colors"
            @click="toggleTagFilter(null)"
          >
            {{ t('onetime.clearFilter') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Lista Spese con Totale -->
    <EntryList
      :empty="!displayedExpenses.length"
      :empty-text="emptyText"
      :total-label="totalLabel"
      :total="money(total)"
    >
      <EntryRow
        v-for="e in displayedExpenses"
        :key="e.id"
        :name="e.name"
        :amount="money(e.amount)"
        :subtitle="e.notes"
        @edit="open(e)"
        @delete="confirmDelete(e.name, () => finance.deleteOneTime(e.id))"
      >
        <template #meta>
          <span>{{ date(e.date) }}</span>
          <TagBadge kind="categories" :id="e.categoryId" />
          <TagBadge kind="paymentMethods" :id="e.paymentMethodId" />
          <TagBadge
            v-for="tagId in e.tagIds"
            :key="tagId"
            kind="tags"
            :id="tagId"
            clickable
            @click.stop="toggleTagFilter(tagId)"
          />
        </template>
      </EntryRow>
    </EntryList>

    <TransactionForm :open="formOpen" kind="expense" :item="editing" @close="formOpen = false" />
  </section>
</template>
