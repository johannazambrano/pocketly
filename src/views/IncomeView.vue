<script setup lang="ts">
import { useHighlight } from '@/composables/useHighlight'
import { computed, ref } from 'vue'
import type { Income } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { todayIso } from '@/utils/dates'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import MonthSelector from '@/components/MonthSelector.vue'
import { usePageAction } from '@/composables/usePageAction'
import { useTagFilteredEntries } from '@/composables/useTagFilteredEntries'
import TagFilterPanel from '@/components/TagFilterPanel.vue'

const finance = useFinanceStore()
const { t, money, date, month, locale } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<Income | null>(null)
const {
  selectedTagId,
  selectedTag,
  displayedItems: displayedIncomes,
  total,
  yearTotalForSelectedTag,
  yearCountForSelectedTag,
  breakdown,
  grandTotalForBreakdown,
  activeYearTags,
  toggleTagFilter,
  revealEntry,
} = useTagFilteredEntries({
  filtered: () => finance.incomesFiltered,
  ofYear: () => finance.incomesOfYear,
  lookupTag: (id) => finance.tag('tags', id),
})
const highlightedId = useHighlight((id) => `entry-${id}`, revealEntry)

const emptyText = computed(() => {
  if (selectedTag.value) {
    return t('income.emptyTag', { tag: selectedTag.value.name })
  }
  if (finance.selectedMonth === 'all') return t('income.empty')
  const name = month(finance.selectedMonth)
  return t('income.emptyMonth', { month: locale.value === 'it' ? name.toLocaleLowerCase('it') : name })
})

const totalLabel = computed(() => {
  if (selectedTag.value) {
    return `${t('common.total')} (#${selectedTag.value.name})`
  }
  return t('common.total')
})

function open(item: Income | null) {
  editing.value = item
  formOpen.value = true
}
usePageAction(() => ({ label: t('income.new'), run: () => open(null) }))

function duplicate(item: Income) {
  editing.value = {
    ...item,
    id: '',
    date: todayIso(),
  }
  formOpen.value = true
}

/** "Elimina" dentro il modulo (sul telefono è l'unico modo): dopo la conferma chiude anche il modulo. */
function remove() {
  const item = editing.value
  if (item) void confirmDelete(item.name, () => {
    finance.deleteIncome(item.id)
    formOpen.value = false
  })
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('income.title')">
      <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <MonthSelector />
        <button type="button" class="btn-primary page-add" @click="open(null)">
          <i class="fa-solid fa-plus mr-1"></i> {{ t('app.add') }}
        </button>
      </div>
    </PageHeader>

    <TagFilterPanel
      section="income"
      :tags="activeYearTags"
      :breakdown="breakdown"
      :grand-total="grandTotalForBreakdown"
      :selected-tag-id="selectedTagId"
      :selected-tag="selectedTag"
      :shown-count="displayedIncomes.length"
      :year-count="yearCountForSelectedTag"
      :year-total="yearTotalForSelectedTag"
      amount-class="text-accent"
      @toggle="toggleTagFilter"
    />

    <!-- Lista Entrate con Totale -->
    <EntryList
      :empty="!displayedIncomes.length"
      :empty-text="emptyText"
      :total-label="totalLabel"
      :total="money(total)"
    >
      <EntryRow
        v-for="e in displayedIncomes"
        :id="`entry-${e.id}`"
        :key="e.id"
        :name="e.name"
        :amount="money(e.amount)"
        amount-class="text-accent"
        :subtitle="e.notes"
        duplicable
        :class="{ 'ring-2 ring-accent rounded-xl bg-accent-soft/30 transition-all duration-500': highlightedId === e.id }"
        @edit="open(e)"
        @duplicate="duplicate(e)"
        @delete="confirmDelete(e.name, () => finance.deleteIncome(e.id))"
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

    <TransactionForm :open="formOpen" kind="income" :item="editing" :deletable="!!editing" @close="formOpen = false" @delete="remove" />
  </section>
</template>
