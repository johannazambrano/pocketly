<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RecurringExpense } from '@/types/models'
import { monthlyEquivalent } from '@/domain/recurrence'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import RecurringForm from '@/components/RecurringForm.vue'

const finance = useFinanceStore()
const { t, money, date } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<RecurringExpense | null>(null)
const monthlyTotal = computed(() => Math.round(finance.recurringOfYear.reduce((acc, r) => acc + monthlyEquivalent(r), 0)))

function open(item: RecurringExpense | null) {
  editing.value = item
  formOpen.value = true
}

function period(r: RecurringExpense) {
  const since = t('recurring.since', { date: date(r.startDate) })
  return r.endDate ? `${since} ${t('recurring.until', { date: date(r.endDate) })}` : since
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('recurring.title')" add-label="" @add="open(null)" />
    <EntryList
      :empty="!finance.recurringOfYear.length"
      :empty-text="t('recurring.empty')"
      :total-label="t('recurring.totalMonthly')"
      :total="money(monthlyTotal)"
    >
      <EntryRow
        v-for="r in finance.recurringOfYear"
        :key="r.id"
        :name="r.name"
        :amount="money(r.amount)"
        :subtitle="period(r)"
        @edit="open(r)"
        @delete="confirmDelete(r.name, () => finance.deleteRecurring(r.id))"
      >
        <template #meta>
          <span>{{ t(`recurring.frequencies.${r.frequency}`) }}</span>
          <TagBadge kind="categories" :id="r.categoryId" />
          <TagBadge kind="paymentMethods" :id="r.paymentMethodId" />
        </template>
      </EntryRow>
    </EntryList>
    <RecurringForm :open="formOpen" :item="editing" @close="formOpen = false" />
  </section>
</template>
