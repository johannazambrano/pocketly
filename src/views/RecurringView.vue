<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { RecurringExpense } from '@/types/models'
import { monthlyEquivalent, type RecurringSeries } from '@/domain/recurrence'
import { formatRulesSummary } from '@/domain/notifications'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import PageHeader from '@/components/PageHeader.vue'
import EntryList from '@/components/EntryList.vue'
import EntryRow from '@/components/EntryRow.vue'
import TagBadge from '@/components/TagBadge.vue'
import RecurringForm from '@/components/RecurringForm.vue'
import BaseModal from '@/components/BaseModal.vue'

const finance = useFinanceStore()
const { t, money, date } = useFormat()
const confirmDelete = useConfirmDelete()
const route = useRoute()

const formOpen = ref(false)
const editing = ref<RecurringExpense | null>(null)
/** Quanto si paga al mese adesso: solo la parte in corso di ogni spesa (non quelle finite o non ancora iniziate). */
const monthlyTotal = computed(() =>
  Math.round(finance.recurringSeriesOfYear.reduce((acc, s) => acc + (s.active ? monthlyEquivalent(s.current) : 0), 0)),
)
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

/**
 * "Elimina" dentro il modulo (sul telefono è l'unico modo): dopo la conferma chiude anche il modulo.
 * Si elimina la spesa intera, con tutte le parti nate dai cambi «da questo addebito in poi».
 */
function remove() {
  const item = editing.value
  if (item) void confirmDelete(item.name, () => {
    finance.deleteRecurringSeries(item)
    formOpen.value = false
  })
}

/** Dal primo addebito della spesa all'ultima data di fine (le parti sono in ordine e non si sovrappongono). */
function period(s: RecurringSeries) {
  const last = s.parts[s.parts.length - 1]!
  const since = t('recurring.since', { date: date(s.parts[0]!.startDate) })
  return last.endDate ? `${since} ${t('recurring.until', { date: date(last.endDate) })}` : since
}

/** Storico di una spesa con più periodi (cambi «da questo addebito in poi»): si apre dall'etichetta nella riga. */
const historyOf = ref<RecurringSeries | null>(null)

/** Da qui si può correggere un periodo: lo storico si chiude e si apre il modulo su quella parte. */
function openPart(part: RecurringExpense) {
  historyOf.value = null
  open(part)
}

function partRange(p: RecurringExpense) {
  return p.endDate ? t('recurring.historyRange', { from: date(p.startDate), to: date(p.endDate) }) : t('recurring.since', { date: date(p.startDate) })
}

function partState(s: RecurringSeries, p: RecurringExpense) {
  if (p.startDate > finance.today) return t('recurring.historyScheduled')
  return s.active && p.id === s.current.id ? t('recurring.historyCurrent') : ''
}
</script>

<template>
  <section class="space-y-4">
    <PageHeader :title="t('recurring.title')" add-label="" @add="open(null)" />
    <EntryList
      :empty="!finance.recurringSeriesOfYear.length"
      :empty-text="t('recurring.empty')"
      :total-label="t('recurring.totalMonthly')"
      :total="money(monthlyTotal)"
    >
      <EntryRow
        v-for="s in finance.recurringSeriesOfYear"
        :id="`entry-${s.current.id}`"
        :key="s.key"
        :name="s.current.name"
        :amount="money(s.current.amount)"
        :subtitle="period(s)"
        :class="{ 'ring-2 ring-accent rounded-xl bg-accent-soft/30 transition-all duration-500': highlightedId === s.current.id }"
        @edit="open(s.current)"
        @delete="confirmDelete(s.current.name, () => finance.deleteRecurringSeries(s.current))"
      >
        <template #meta>
          <span>{{ t(`recurring.frequencies.${s.current.frequency}`) }}</span>
          <TagBadge kind="categories" :id="s.current.categoryId" />
          <TagBadge kind="paymentMethods" :id="s.current.paymentMethodId" />
          <span
            v-if="s.current.notifications?.length"
            class="inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-3"
            :title="formatRulesSummary(s.current.notifications, t)"
          >
            <i class="fa-solid fa-bell text-[10px] text-accent-icon"></i>
            <span>{{ formatRulesSummary(s.current.notifications, t) }}</span>
          </span>
          <button
            v-if="s.parts.length > 1"
            type="button"
            class="inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface-4 active:scale-95"
            @click="historyOf = s"
          >
            <i class="fa-solid fa-clock-rotate-left text-[10px]" aria-hidden="true"></i>
            {{ t('recurring.history') }}
          </button>
        </template>
      </EntryRow>
    </EntryList>
    <BaseModal :open="!!historyOf" :title="historyOf ? t('recurring.historyOf', { name: historyOf.current.name }) : ''" @close="historyOf = null">
      <div v-if="historyOf" class="space-y-3">
        <p class="text-xs text-ink-3">{{ t('recurring.historyHint') }}</p>
        <ul class="divide-y divide-line-soft overflow-hidden rounded-lg bg-surface-2">
          <li v-for="p in historyOf.parts" :key="p.id">
            <button type="button" class="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-3" @click="openPart(p)">
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-ink">{{ money(p.amount) }} · {{ t(`recurring.frequencies.${p.frequency}`) }}</span>
                <span class="block text-xs text-ink-3">{{ partRange(p) }}</span>
              </span>
              <span v-if="partState(historyOf, p)" class="shrink-0 rounded-full bg-accent-soft-2 px-2 py-0.5 text-[11px] font-medium text-accent-strongest">
                {{ partState(historyOf, p) }}
              </span>
              <i class="fa-solid fa-chevron-right shrink-0 text-xs text-ink-4" aria-hidden="true"></i>
            </button>
          </li>
        </ul>
      </div>
    </BaseModal>
    <RecurringForm :open="formOpen" :item="editing" :deletable="!!editing" @close="formOpen = false" @delete="remove" />
  </section>
</template>
