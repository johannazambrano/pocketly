<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useFormat } from '@/i18n'
import { useConfirmDelete } from '@/composables/useConfirmDelete'
import { budgetMonth, MIN_PACE_DAYS, suggestLimits, type BudgetStatus } from '@/domain/budget'
import {
  calculateGoalProgress,
  calculateMonthsRemaining,
  calculateRemainingAmount,
  calculateSavingsQuota,
  goalStatus,
} from '@/domain/savings'
import type { SavingsGoal } from '@/types/models'
import { parseIsoDate } from '@/utils/dates'
import { toCents } from '@/utils/money'
import BudgetBar from '@/components/BudgetBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import SavingsGoalForm from '@/components/SavingsGoalForm.vue'
import SavingsDepositModal from '@/components/SavingsDepositModal.vue'

const finance = useFinanceStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const confirmDelete = useConfirmDelete()
const { t, money, month, date, percent, locale } = useFormat()

// --- tab switcher ---------------------------------------------------------
type TabKey = 'budget' | 'savings'
const activeTab = ref<TabKey>('budget')
const highlightedId = ref<string | null>(null)

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'savings') activeTab.value = 'savings'
    else if (tab === 'budget') activeTab.value = 'budget'
  },
  { immediate: true },
)

watch(
  () => route.query.highlight,
  (id) => {
    if (!id || typeof id !== 'string') return
    highlightedId.value = id
    activeTab.value = 'savings'
    nextTick(() => {
      const el = document.getElementById(`goal-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  },
  { immediate: true },
)

function switchTab(tab: TabKey) {
  activeTab.value = tab
  void router.replace({ query: { ...route.query, tab } })
}

// --- logica budget mensile ------------------------------------------------
const monthIndex = ref(parseIsoDate(finance.today).month)
const year = computed(() => finance.selectedYear)
const monthLabel = computed(() => `${month(monthIndex.value)} ${year.value}`)

const b = computed(() => budgetMonth(finance.data, year.value, monthIndex.value, finance.today))
const isCurrent = computed(() => b.value.daysLeft !== null)
const hasLimits = computed(() => b.value.lines.length > 0)
const categories = computed(() => [...finance.data.categories].sort((a, c) => a.name.localeCompare(c.name)))

const TEXT: Record<BudgetStatus, string> = { ok: 'text-accent', warning: 'text-caution-icon', over: 'text-negative' }

function remainingText(remaining: number): string {
  return remaining >= 0 ? t('budget.remaining', { amount: money(remaining) }) : t('budget.over', { amount: money(-remaining) })
}

function limitText(id: string): string {
  const cents = finance.data.budget.limits[id]
  if (!cents) return ''
  if (cents % 100 === 0) return String(cents / 100)
  const text = (cents / 100).toFixed(2)
  return locale.value === 'it' ? text.replace('.', ',') : text
}

function onLimit(id: string, e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.value.trim()
  const amount = raw === '' ? null : toCents(raw)
  if (raw !== '' && (amount === null || amount < 0)) ui.toast(t('budget.invalidAmount'), 'error')
  else finance.setBudgetLimit(id, amount)
  input.value = limitText(id)
}

function suggest() {
  const proposals = Object.entries(suggestLimits(finance.data, year.value, monthIndex.value)).filter(
    ([id]) => !finance.data.budget.limits[id],
  )
  for (const [id, amount] of proposals) finance.setBudgetLimit(id, amount)
  if (proposals.length) ui.toast(t('budget.suggested', { n: proposals.length }, proposals.length))
  else ui.toast(t('budget.noSuggestion'), 'error')
}

// --- logica salvadanai e obiettivi di risparmio ----------------------------
const formOpen = ref(false)
const editingGoal = ref<SavingsGoal | null>(null)
const depositModalOpen = ref(false)
const selectedGoalForDeposit = ref<SavingsGoal | null>(null)

const summary = computed(() => finance.savingsSummaryData)

function openNewGoal() {
  editingGoal.value = null
  formOpen.value = true
}

function openEditGoal(goal: SavingsGoal) {
  editingGoal.value = goal
  formOpen.value = true
}

function openDepositModal(goal: SavingsGoal) {
  selectedGoalForDeposit.value = goal
  depositModalOpen.value = true
}

function quickAdd(goal: SavingsGoal, deltaCents: number) {
  finance.adjustSavingsGoalAmount(goal.id, deltaCents)
  ui.toast(t('savings.quickDepositSuccess', { amount: money(deltaCents), name: goal.name }))
}

function deleteGoal(goal: SavingsGoal) {
  void confirmDelete(goal.name, () => {
    finance.deleteSavingsGoal(goal.id)
  })
}

function onDeleteFromForm() {
  if (editingGoal.value) {
    const item = editingGoal.value
    void confirmDelete(item.name, () => {
      finance.deleteSavingsGoal(item.id)
      formOpen.value = false
    })
  }
}
</script>

<template>
  <section class="space-y-4">
    <!-- Intestazione pagina con selettore mese o pulsante nuovo salvadanaio -->
    <PageHeader :title="t('budget.title')">
      <!-- Azioni per tab Budget Mensile -->
      <div v-if="activeTab === 'budget'" class="flex items-center gap-1">
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('budget.prevMonth')"
          :disabled="monthIndex === 0"
          @click="monthIndex--"
        >
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="min-w-32 text-center text-sm font-semibold text-ink-2" aria-live="polite">{{ monthLabel }}</span>
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('budget.nextMonth')"
          :disabled="monthIndex === 11"
          @click="monthIndex++"
        >
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      <!-- Azioni per tab Salvadanai -->
      <div v-else class="flex items-center gap-2">
        <button type="button" class="btn-primary" @click="openNewGoal">
          <i class="fa-solid fa-plus mr-1.5"></i>{{ t('savings.new') }}
        </button>
      </div>
    </PageHeader>

    <!-- Selettore Navigazione a Schede (Tabs) -->
    <div class="flex items-center gap-1 rounded-xl bg-surface-3 p-1 w-fit">
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors"
        :class="activeTab === 'budget' ? 'bg-surface text-ink-strong shadow-xs' : 'text-ink-4 hover:text-ink-2'"
        @click="switchTab('budget')"
      >
        <i class="fa-solid fa-sliders text-xs"></i>
        <span>{{ t('budget.tabs.spending') }}</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors"
        :class="activeTab === 'savings' ? 'bg-surface text-ink-strong shadow-xs' : 'text-ink-4 hover:text-ink-2'"
        @click="switchTab('savings')"
      >
        <i class="fa-solid fa-piggy-bank text-xs"></i>
        <span>{{ t('budget.tabs.savings') }}</span>
        <span
          v-if="finance.savingsGoals.length"
          class="ml-1 rounded-full px-1.5 py-0.2 text-[11px] font-bold"
          :class="activeTab === 'savings' ? 'bg-surface-3 text-ink-2' : 'bg-surface text-ink-3'"
        >
          {{ finance.savingsGoals.length }}
        </span>
      </button>
    </div>

    <!-- VISTA 1: Budget Spese Mensile -->
    <div v-if="activeTab === 'budget'" class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div class="space-y-4">
        <div v-if="!hasLimits" class="card space-y-1 text-sm text-ink-4">
          <p class="font-semibold text-ink-2">{{ t('budget.emptyTitle') }}</p>
          <p>{{ t('budget.emptyHint') }}</p>
        </div>

        <template v-else>
          <div class="card space-y-3">
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-xs font-medium text-ink-4">{{ t('budget.summary') }}</p>
              <p v-if="b.status === 'warning'" class="text-xs font-semibold text-caution-icon">{{ t('budget.nearLimit') }}</p>
            </div>
            <p class="text-2xl font-bold" :class="TEXT[b.status]">{{ remainingText(b.totalRemaining) }}</p>
            <BudgetBar
              :limit="b.totalLimit"
              :spent="b.totalSpent"
              :scheduled="b.totalScheduled"
              :status="b.status"
              :label="t('budget.summary')"
            />
            <p class="text-xs text-ink-4">
              {{ t('budget.spentOf', { spent: money(b.totalSpent + b.totalScheduled), limit: money(b.totalLimit) }) }}
              <span v-if="b.totalScheduled > 0" class="block text-ink-4">
                {{ t('budget.scheduled', { amount: money(b.totalScheduled) }) }}
              </span>
            </p>

            <div v-if="isCurrent" class="space-y-1.5 border-t border-line-soft pt-3 text-sm">
              <p v-if="b.dailyAvailable !== null" class="text-ink-2">
                <span class="font-bold text-recurring">{{ money(b.dailyAvailable) }}</span>
                {{ t('budget.daily') }}
                <span class="text-xs text-ink-4">{{ t('budget.dailyDays', { n: b.daysLeft }, b.daysLeft ?? 0) }}</span>
              </p>
              <p v-else class="font-medium text-negative">{{ t('budget.exhausted') }}</p>

              <p v-if="b.projected !== null" class="text-ink-2">
                {{ t('budget.pace', { amount: money(b.projected) }) }}
                <span :class="b.projected > b.totalLimit ? 'font-semibold text-negative' : 'text-accent'">
                  {{
                    b.projected > b.totalLimit
                      ? t('budget.paceOver', { amount: money(b.projected - b.totalLimit) })
                      : t('budget.paceUnder', { amount: money(b.totalLimit - b.projected) })
                  }}
                </span>
              </p>
              <p v-else class="text-xs text-ink-4">{{ t('budget.paceLater', { day: MIN_PACE_DAYS }) }}</p>
            </div>
          </div>

          <div class="card divide-y divide-line-soft">
            <div v-for="l in b.lines" :key="l.categoryId" class="space-y-1.5 py-3 first:pt-0 last:pb-0">
              <div class="flex items-center justify-between gap-2 text-sm">
                <span class="flex min-w-0 items-center gap-2 font-medium text-ink-2">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: finance.tag('categories', l.categoryId)?.color }"></span>
                  <span class="truncate">{{ finance.tag('categories', l.categoryId)?.name ?? t('common.unknown') }}</span>
                </span>
                <span class="shrink-0 text-xs text-ink-4">
                  {{ money(l.spent + l.scheduled) }} / {{ money(l.limit) }}
                  <span class="font-semibold" :class="TEXT[l.status]">{{ percent((l.spent + l.scheduled) / l.limit) }}</span>
                </span>
              </div>
              <BudgetBar
                :limit="l.limit"
                :spent="l.spent"
                :scheduled="l.scheduled"
                :status="l.status"
                :label="finance.tag('categories', l.categoryId)?.name ?? ''"
              />
              <div class="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                <span class="font-medium" :class="TEXT[l.status]">
                  {{ remainingText(l.remaining) }}<template v-if="l.status === 'warning'"> · {{ t('budget.nearLimit') }}</template>
                </span>
                <span
                  v-if="l.projected !== null"
                  :class="l.projected > l.limit ? 'font-medium text-caution-icon' : 'text-ink-4'"
                >
                  {{ t('budget.projectedShort', { amount: money(l.projected) }) }}
                </span>
              </div>
            </div>
          </div>

          <p v-if="b.unbudgeted > 0" class="px-1 text-xs text-ink-4">
            <i class="fa-solid fa-circle-info mr-1 text-ink-5"></i>{{ t('budget.unbudgeted', { amount: money(b.unbudgeted) }) }}
          </p>
        </template>
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-ink-2">
          <i class="fa-solid fa-sliders mr-1 text-accent"></i> {{ t('budget.limitsTitle') }}
        </h3>
        <p class="text-xs text-ink-4">{{ t('budget.limitsHint') }}</p>
        <div class="space-y-1.5">
          <label v-for="c in categories" :key="c.id" class="flex items-center justify-between gap-3 text-sm">
            <span class="flex min-w-0 items-center gap-2 text-ink-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: c.color }"></span>
              <span class="truncate">{{ c.name }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-1.5 text-ink-4">
              <input
                :value="limitText(c.id)"
                inputmode="decimal"
                placeholder="—"
                :aria-label="t('budget.limitLabel', { name: c.name })"
                class="field w-28 text-right"
                @change="onLimit(c.id, $event)"
              />
              €
            </span>
          </label>
          <p v-if="!categories.length" class="text-xs text-ink-4 italic">{{ t('budget.noCategories') }}</p>
        </div>
        <div class="space-y-1.5 border-t border-line-soft pt-3">
          <button type="button" class="btn-primary w-full" @click="suggest">
            <i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i>{{ t('budget.suggest') }}
          </button>
          <p class="text-xs text-ink-4">{{ t('budget.suggestHint') }}</p>
        </div>
      </div>
    </div>

    <!-- VISTA 2: Salvadanai & Obiettivi di Risparmio -->
    <div v-else class="space-y-4">
      <!-- Pannello Riepilogo Risparmio -->
      <div v-if="finance.savingsGoals.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- Card Avanzamento Globale -->
        <div class="card space-y-3">
          <div class="flex items-baseline justify-between text-xs text-ink-4 font-medium">
            <span>{{ t('savings.totalSaved') }}</span>
            <span class="font-bold text-ink-2">{{ percent(summary.overallProgress) }}</span>
          </div>

          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-accent">{{ money(summary.totalCurrent) }}</span>
            <span class="text-xs text-ink-4 font-medium">{{ t('savings.targetLabel') }}: {{ money(summary.totalTarget) }}</span>
          </div>

          <!-- Barra globale -->
          <div
            class="h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            :aria-label="t('savings.totalSaved')"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(summary.overallProgress * 100)"
          >
            <div
              class="h-full bg-accent-bright transition-all duration-300 rounded-full"
              :style="{ width: `${Math.round(summary.overallProgress * 100)}%` }"
            ></div>
          </div>

          <p class="text-xs text-ink-4">
            <template v-if="summary.totalRemaining > 0">
              {{ t('savings.remainingLabel') }} <span class="font-semibold text-ink-2">{{ money(summary.totalRemaining) }}</span>
            </template>
            <template v-else>
              <span class="font-semibold text-accent">{{ t('savings.completedNotice') }}</span>
            </template>
          </p>
        </div>

        <!-- Card Quota Mensile e Stato -->
        <div class="card space-y-3">
          <p class="text-xs font-medium text-ink-4">{{ t('savings.recommendedQuota') }}</p>
          <p class="text-2xl font-bold text-ink-strong">
            {{ money(summary.totalMonthlyQuota) }}
            <span class="text-xs font-normal text-ink-4">/ {{ t('common.month').toLowerCase() }}</span>
          </p>

          <div class="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span class="rounded-full bg-surface-3 px-2.5 py-0.5 font-medium text-ink-2">
              <i class="fa-solid fa-spinner mr-1 text-ink-4"></i>{{ summary.activeCount }} {{ t('savings.status.active').toLowerCase() }}
            </span>
            <span v-if="summary.completedCount" class="rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent">
              <i class="fa-solid fa-circle-check mr-1"></i>{{ summary.completedCount }} {{ t('savings.status.completed').toLowerCase() }}
            </span>
            <span v-if="summary.overdueCount" class="rounded-full bg-negative-soft px-2.5 py-0.5 font-semibold text-negative">
              <i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ summary.overdueCount }} {{ t('savings.status.overdue').toLowerCase() }}
            </span>
          </div>
        </div>
      </div>

      <!-- Stato vuoto quando non ci sono salvadanai -->
      <div v-if="!finance.savingsGoals.length" class="card py-10 text-center space-y-3">
        <div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-xl text-ink-4">
          <i class="fa-solid fa-piggy-bank"></i>
        </div>
        <div class="space-y-1">
          <p class="font-semibold text-ink-2">{{ t('savings.emptyTitle') }}</p>
          <p class="max-w-md mx-auto text-xs text-ink-4">{{ t('savings.emptyHint') }}</p>
        </div>
        <div class="pt-2">
          <button type="button" class="btn-primary" @click="openNewGoal">
            <i class="fa-solid fa-plus mr-1.5"></i>{{ t('savings.createFirst') }}
          </button>
        </div>
      </div>

      <!-- Griglia Salvadanai -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="goal in finance.savingsGoals"
          :id="`goal-${goal.id}`"
          :key="goal.id"
          class="card space-y-3 transition-all"
          :class="{
            'ring-2 ring-accent ring-offset-2': highlightedId === goal.id,
            'opacity-90': goalStatus(goal, finance.today) === 'completed',
          }"
        >
          <!-- Intestazione card: Nome, pallino colore e badge stato -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="h-3.5 w-3.5 shrink-0 rounded-full"
                :style="{ backgroundColor: goal.color || 'var(--pk-accent)' }"
              ></span>
              <h3 class="font-bold text-ink-strong truncate text-base">{{ goal.name }}</h3>
            </div>

            <!-- Badge stato -->
            <span
              v-if="goalStatus(goal, finance.today) === 'completed'"
              class="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent inline-flex items-center gap-1"
            >
              <i class="fa-solid fa-circle-check text-[11px]"></i>
              {{ t('savings.status.completed') }}
            </span>
            <span
              v-else-if="goalStatus(goal, finance.today) === 'overdue'"
              class="shrink-0 rounded-full bg-negative-soft px-2 py-0.5 text-xs font-semibold text-negative inline-flex items-center gap-1"
            >
              <i class="fa-solid fa-triangle-exclamation text-[11px]"></i>
              {{ t('savings.status.overdue') }}
            </span>
            <span
              v-else
              class="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-3 inline-flex items-center gap-1"
            >
              <i class="fa-solid fa-calendar-day text-[11px] text-ink-4"></i>
              {{ date(goal.targetDate) }}
            </span>
          </div>

          <!-- Note opzionali -->
          <p v-if="goal.notes" class="text-xs text-ink-3 italic line-clamp-2">{{ goal.notes }}</p>

          <!-- Cifre e percentuali -->
          <div class="space-y-1.5">
            <div class="flex items-baseline justify-between text-xs">
              <span class="font-semibold text-ink">
                {{ money(goal.currentAmount) }}
                <span class="font-normal text-ink-4">/ {{ money(goal.targetAmount) }}</span>
              </span>
              <span class="font-bold text-ink-2">{{ percent(calculateGoalProgress(goal)) }}</span>
            </div>

            <!-- Barra di progresso del salvadanaio -->
            <div
              class="h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              :aria-label="goal.name"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="Math.round(calculateGoalProgress(goal) * 100)"
            >
              <div
                class="h-full rounded-full transition-all duration-300"
                :style="{
                  width: `${Math.round(calculateGoalProgress(goal) * 100)}%`,
                  backgroundColor: goal.color || 'var(--pk-accent-bright)',
                }"
              ></div>
            </div>
          </div>

          <!-- Quota mensile o avviso completamento -->
          <div class="rounded-lg bg-surface-2 p-2.5 text-xs space-y-0.5">
            <div v-if="goalStatus(goal, finance.today) === 'completed'" class="flex items-center gap-1.5 font-semibold text-accent">
              <i class="fa-solid fa-champagne-glasses"></i>
              <span>{{ t('savings.completedNotice') }}</span>
            </div>
            <div v-else-if="goalStatus(goal, finance.today) === 'overdue'" class="flex items-center gap-1.5 font-medium text-negative">
              <i class="fa-solid fa-circle-exclamation"></i>
              <span>{{ t('savings.overdueNotice', { amount: money(calculateRemainingAmount(goal)) }) }}</span>
            </div>
            <div v-else class="flex flex-wrap items-baseline justify-between gap-1 text-ink-2">
              <span>
                {{ t('savings.recommendedQuota') }}:
                <strong class="text-ink-strong">{{ money(calculateSavingsQuota(goal, finance.today)) }}</strong> / mese
              </span>
              <span class="text-ink-4">
                ({{ t('savings.monthsLeft', { n: calculateMonthsRemaining(finance.today, goal.targetDate) }, calculateMonthsRemaining(finance.today, goal.targetDate)) }})
              </span>
            </div>
          </div>

          <!-- Pulsantiera e azioni rapide -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2 text-xs">
            <!-- Chip versamento rapido -->
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="rounded-md bg-surface-3 px-2 py-1 font-semibold text-ink-2 hover:bg-surface-4 transition-colors"
                :title="t('savings.deposit') + ' +10 €'"
                @click="quickAdd(goal, 1000)"
              >
                +10 €
              </button>
              <button
                type="button"
                class="rounded-md bg-surface-3 px-2 py-1 font-semibold text-ink-2 hover:bg-surface-4 transition-colors"
                :title="t('savings.deposit') + ' +50 €'"
                @click="quickAdd(goal, 5000)"
              >
                +50 €
              </button>
              <button
                type="button"
                class="rounded-md bg-surface-3 px-2 py-1 font-semibold text-ink-2 hover:bg-surface-4 transition-colors"
                :title="t('savings.deposit') + ' +100 €'"
                @click="quickAdd(goal, 10000)"
              >
                +100 €
              </button>
            </div>

            <!-- Azioni gestione: Versa/Preleva, Modifica, Elimina -->
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="icon-btn text-accent font-medium text-xs px-2 w-auto h-7 rounded-md bg-accent-soft hover:bg-accent-soft/80"
                @click="openDepositModal(goal)"
              >
                <i class="fa-solid fa-wallet mr-1 text-[11px]"></i>
                {{ t('savings.deposit') }}
              </button>
              <button
                type="button"
                class="icon-btn text-ink-3 hover:text-ink"
                :aria-label="t('common.edit')"
                @click="openEditGoal(goal)"
              >
                <i class="fa-solid fa-pen-to-square text-xs"></i>
              </button>
              <button
                type="button"
                class="icon-btn text-negative-light hover:text-negative"
                :aria-label="t('common.delete')"
                @click="deleteGoal(goal)"
              >
                <i class="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modale Nuovo/Modifica Salvadanaio -->
    <SavingsGoalForm
      :open="formOpen"
      :item="editingGoal"
      :deletable="!!editingGoal"
      @close="formOpen = false"
      @delete="onDeleteFromForm"
    />

    <!-- Modale Versamento / Prelievo -->
    <SavingsDepositModal
      :open="depositModalOpen"
      :goal="selectedGoalForDeposit"
      @close="depositModalOpen = false"
    />
  </section>
</template>
