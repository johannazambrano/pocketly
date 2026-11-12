<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RecurringException, RecurringExpense } from '@/types/models'
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

const formOpen = ref(false)
const editing = ref<RecurringExpense | null>(null)
/** Quanto si paga al mese adesso: solo la parte in corso di ogni spesa (non quelle finite o non ancora iniziate). */
const monthlyTotal = computed(() =>
  Math.round(finance.recurringSeriesOfYear.reduce((acc, s) => acc + (s.active ? monthlyEquivalent(s.current) : 0), 0)),
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

/**
 * Storico di una spesa con più periodi (cambi «da questo addebito in poi») o con addebiti cambiati o saltati da soli:
 * si apre dall'etichetta nella riga. Si ricorda la chiave, non la spesa: dopo un «Ripristina» lo storico si aggiorna,
 * e si chiude da solo quando non resta niente da raccontare.
 */
const historyKey = ref<string | null>(null)
/** L'etichetta «Storico» compare solo quando c'è qualcosa da raccontare. */
const hasHistory = (s: RecurringSeries) => s.parts.length > 1 || s.parts.some((p) => p.exceptions?.length)
const historyOf = computed(() => {
  const s = finance.recurringSeriesOfYear.find((x) => x.key === historyKey.value)
  return s && hasHistory(s) ? s : null
})

/** Da qui si può correggere un periodo: lo storico si chiude e si apre il modulo su quella parte. */
function openPart(part: RecurringExpense) {
  historyKey.value = null
  open(part)
}

/** Una riga per addebito cambiato da solo: saltato, o con importo (e giorno) diversi. */
function exceptionText(p: RecurringExpense, e: RecurringException) {
  if (e.skipped) return t('recurring.historySkipped', { date: date(e.date) })
  const amount = money(e.amount ?? p.amount)
  return e.movedTo
    ? t('recurring.historyMoved', { date: date(e.date), amount, moved: date(e.movedTo) })
    : t('recurring.historyChanged', { date: date(e.date), amount })
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
        :key="s.key"
        :name="s.current.name"
        :amount="money(s.current.amount)"
        :subtitle="period(s)"
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
            v-if="hasHistory(s)"
            type="button"
            class="inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface-4 active:scale-95"
            @click="historyKey = s.key"
          >
            <i class="fa-solid fa-clock-rotate-left text-[10px]" aria-hidden="true"></i>
            {{ t('recurring.history') }}
          </button>
        </template>
      </EntryRow>
    </EntryList>
    <BaseModal :open="!!historyOf" :title="historyOf ? t('recurring.historyOf', { name: historyOf.current.name }) : ''" @close="historyKey = null">
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
            <!-- Gli addebiti di questo periodo cambiati o saltati da soli, ognuno ripristinabile. -->
            <ul v-if="p.exceptions?.length" class="space-y-1 px-3 pb-2">
              <li v-for="e in p.exceptions" :key="e.date" class="flex items-center justify-between gap-3 rounded-md bg-surface px-2.5 py-1.5 text-xs text-ink-2">
                <span :class="{ 'line-through decoration-ink-4': e.skipped }">{{ exceptionText(p, e) }}</span>
                <button
                  type="button"
                  class="shrink-0 rounded px-2 py-1.5 font-medium text-accent hover:bg-surface-3"
                  :aria-label="t('recurring.restoreLabel', { date: date(e.date) })"
                  @click="finance.restoreRecurringCharge(p, e.date)"
                >
                  {{ t('recurring.restore') }}
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </BaseModal>
    <RecurringForm :open="formOpen" :item="editing" :deletable="!!editing" @close="formOpen = false" @delete="remove" />
  </section>
</template>
