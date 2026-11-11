<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useFormat } from '@/i18n'
import { budgetMonth, MIN_PACE_DAYS, suggestLimits, type BudgetStatus } from '@/domain/budget'
import { parseIsoDate } from '@/utils/dates'
import { toCents } from '@/utils/money'
import BudgetBar from '@/components/BudgetBar.vue'

const finance = useFinanceStore()
const ui = useUiStore()
const { t, money, month, percent, locale } = useFormat()

const monthIndex = ref(parseIsoDate(finance.today).month)
const year = computed(() => finance.selectedYear)
const monthLabel = computed(() => `${month(monthIndex.value)} ${year.value}`)

const b = computed(() => budgetMonth(finance.data, year.value, monthIndex.value, finance.today))
const isCurrent = computed(() => b.value.daysLeft !== null)
const hasLimits = computed(() => b.value.lines.length > 0)
const categories = computed(() => [...finance.data.categories].sort((a, c) => a.name.localeCompare(c.name)))

const TEXT: Record<BudgetStatus, string> = { ok: 'text-accent-icon', warning: 'text-caution-icon', over: 'text-negative' }

/** Il risultato del mese in una riga: quanto resta, o di quanto si è sforato. */
function remainingText(remaining: number): string {
  return remaining >= 0 ? t('budget.remaining', { amount: money(remaining) }) : t('budget.over', { amount: money(-remaining) })
}

// --- limiti ---------------------------------------------------------------

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
  // Il valore mostrato torna sempre quello salvato (anche se il testo digitato era sbagliato).
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
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-lg font-bold text-ink">{{ t('budget.title') }}</h2>
      <div class="flex items-center gap-1">
        <button type="button" class="icon-btn" :aria-label="t('budget.prevMonth')" :disabled="monthIndex === 0" @click="monthIndex--">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="min-w-32 text-center text-sm font-semibold text-ink-2" aria-live="polite">{{ monthLabel }}</span>
        <button type="button" class="icon-btn" :aria-label="t('budget.nextMonth')" :disabled="monthIndex === 11" @click="monthIndex++">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
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
              <span v-if="b.totalScheduled > 0" class="block text-ink-5">
                {{ t('budget.scheduled', { amount: money(b.totalScheduled) }) }}
              </span>
            </p>

            <div v-if="isCurrent" class="space-y-1.5 border-t border-line-soft pt-3 text-sm">
              <p v-if="b.dailyAvailable !== null" class="text-ink-2">
                <span class="font-bold text-recurring">{{ money(b.dailyAvailable) }}</span>
                {{ t('budget.daily') }}
                <span class="text-xs text-ink-5">{{ t('budget.dailyDays', { n: b.daysLeft }, b.daysLeft ?? 0) }}</span>
              </p>
              <p v-else class="font-medium text-negative">{{ t('budget.exhausted') }}</p>

              <p v-if="b.projected !== null" class="text-ink-2">
                {{ t('budget.pace', { amount: money(b.projected) }) }}
                <span :class="b.projected > b.totalLimit ? 'font-semibold text-negative' : 'text-accent-icon'">
                  {{
                    b.projected > b.totalLimit
                      ? t('budget.paceOver', { amount: money(b.projected - b.totalLimit) })
                      : t('budget.paceUnder', { amount: money(b.totalLimit - b.projected) })
                  }}
                </span>
              </p>
              <p v-else class="text-xs text-ink-5">{{ t('budget.paceLater', { day: MIN_PACE_DAYS }) }}</p>
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
                  :class="l.projected > l.limit ? 'font-medium text-caution-icon' : 'text-ink-5'"
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
          <i class="fa-solid fa-sliders mr-1 text-accent-icon"></i> {{ t('budget.limitsTitle') }}
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
          <p v-if="!categories.length" class="text-xs text-ink-5 italic">{{ t('budget.noCategories') }}</p>
        </div>
        <div class="space-y-1.5 border-t border-line-soft pt-3">
          <button type="button" class="btn-primary w-full" @click="suggest">
            <i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i>{{ t('budget.suggest') }}
          </button>
          <p class="text-xs text-ink-4">{{ t('budget.suggestHint') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
