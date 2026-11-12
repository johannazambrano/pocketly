<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { RecurringExpense } from '@/types/models'
import { monthlyEquivalent } from '@/domain/recurrence'
import { formatRulesSummary } from '@/domain/notifications'
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
const route = useRoute()

const formOpen = ref(false)
const editing = ref<RecurringExpense | null>(null)
const monthlyTotal = computed(() => Math.round(finance.recurringOfYear.reduce((acc, r) => acc + monthlyEquivalent(r), 0)))
const highlightedId = ref<string | null>(null)

watch(
  () => route.query.highlight,
  (id) => {
    if (!id || typeof id !== 'string') return
    highlightedId.value = id
    nextTick(() => {
      const el = document.getElementById(`entry-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  },
  { immediate: true },
)

function open(item: RecurringExpense | null) {
  editing.value = item
  formOpen.value = true
}

/** "Elimina" dentro il modulo (sul telefono è l'unico modo): dopo la conferma chiude anche il modulo. */
function remove() {
  const item = editing.value
  if (item) void confirmDelete(item.name, () => {
    finance.deleteRecurring(item.id)
    formOpen.value = false
  })
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
        :id="`entry-${r.id}`"
        :key="r.id"
        :name="r.name"
        :amount="money(r.amount)"
        :subtitle="period(r)"
        :class="{ 'ring-2 ring-accent rounded-xl bg-accent-soft/30 transition-all duration-500': highlightedId === r.id }"
        @edit="open(r)"
        @delete="confirmDelete(r.name, () => finance.deleteRecurring(r.id))"
      >
        <template #meta>
          <span>{{ t(`recurring.frequencies.${r.frequency}`) }}</span>
          <TagBadge kind="categories" :id="r.categoryId" />
          <TagBadge kind="paymentMethods" :id="r.paymentMethodId" />
          <span
            v-if="r.notifications?.length"
            class="inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-3"
            :title="formatRulesSummary(r.notifications, t)"
          >
            <i class="fa-solid fa-bell text-[10px] text-accent-icon"></i>
            <span>{{ formatRulesSummary(r.notifications, t) }}</span>
          </span>
        </template>
      </EntryRow>
    </EntryList>
    <RecurringForm :open="formOpen" :item="editing" :deletable="!!editing" @close="formOpen = false" @delete="remove" />
  </section>
</template>
