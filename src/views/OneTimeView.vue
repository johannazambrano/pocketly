<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OneTimeExpense } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import TransactionForm from '@/components/TransactionForm.vue'

const finance = useFinanceStore()
const { t, money, date } = useFormat()
const confirmDelete = useConfirmDelete()

const formOpen = ref(false)
const editing = ref<OneTimeExpense | null>(null)
const total = computed(() => finance.oneTimeOfYear.reduce((acc, e) => acc + e.amount, 0))

function open(item: OneTimeExpense | null) {
  editing.value = item
  formOpen.value = true
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('onetime.title')" add-label="" @add="open(null)" />
    <EntryList
      :empty="!finance.oneTimeOfYear.length"
      :empty-text="t('onetime.empty')"
      :total-label="t('common.total')"
      :total="money(total)"
    >
      <EntryRow
        v-for="e in finance.oneTimeOfYear"
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
        </template>
      </EntryRow>
    </EntryList>
    <TransactionForm :open="formOpen" kind="expense" :item="editing" @close="formOpen = false" />
  </section>
</template>
