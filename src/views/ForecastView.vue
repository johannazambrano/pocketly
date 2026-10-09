<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { toCents } from '@/utils/money'

const finance = useFinanceStore()
const { t, money, month } = useFormat()

/** Nell'anno corrente si possono simulare solo i mesi da oggi in poi. */
const firstSimMonth = computed(() => {
  const now = new Date()
  return finance.selectedYear === now.getFullYear() ? now.getMonth() : 0
})
const simMonths = computed(() => Array.from({ length: 12 - firstSimMonth.value }, (_, i) => firstSimMonth.value + i))

const sim = reactive({ name: '', amount: '', month: 0 })
watch(firstSimMonth, (m) => (sim.month = m), { immediate: true })

function addSimulation() {
  const amount = toCents(sim.amount)
  if (!sim.name.trim() || amount === null || amount <= 0) return
  finance.addSimulation({ name: sim.name.trim(), amount, year: finance.selectedYear, month: sim.month })
  sim.name = ''
  sim.amount = ''
}
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-bold text-slate-800">{{ t('forecast.title') }}</h2>

    <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">
          <i class="fa-solid fa-wand-magic-sparkles mr-1 text-indigo-600"></i> {{ t('forecast.simulateTitle') }}
        </h3>
        <p class="text-xs text-slate-500">{{ t('forecast.simulateHint') }}</p>
        <form class="space-y-2" @submit.prevent="addSimulation">
          <input v-model="sim.name" required maxlength="80" :placeholder="t('forecast.simNamePlaceholder')" class="field" />
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input v-model="sim.amount" required inputmode="decimal" placeholder="0,00" class="field" />
            <select v-model.number="sim.month" class="field" :aria-label="t('common.month')">
              <option v-for="m in simMonths" :key="m" :value="m">{{ month(m) }}</option>
            </select>
            <button type="submit" class="col-span-2 min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white sm:col-span-1">{{ t('forecast.simulate') }}</button>
          </div>
        </form>
        <div class="space-y-1 pt-1">
          <div
            v-for="s in finance.simulationsOfYear"
            :key="s.id"
            class="flex items-center justify-between gap-2 rounded bg-indigo-50 py-1 pr-1 pl-2.5 text-xs"
          >
            <span class="min-w-0">
              <strong>{{ s.name }}</strong> ({{ month(s.month) }}):
              <span class="font-semibold text-indigo-700">{{ money(s.amount) }}</span>
            </span>
            <button type="button" class="icon-btn shrink-0 text-rose-500" :aria-label="t('common.delete')" @click="finance.deleteSimulation(s.id)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <p v-if="!finance.simulationsOfYear.length" class="text-xs text-slate-400 italic">{{ t('forecast.noSimulations') }}</p>
        </div>
      </div>

      <div class="card space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">
          <i class="fa-solid fa-chart-line mr-1 text-emerald-600"></i> {{ t('forecast.projectionTitle') }}
        </h3>
        <p class="text-xs text-slate-500">{{ t('forecast.projectionHint') }}</p>
        <div class="-mx-4 overflow-x-auto px-4">
          <table class="w-full border-collapse text-left text-xs">
            <thead class="bg-slate-100 text-slate-600">
              <tr>
                <th class="p-2">{{ t('common.month') }}</th>
                <th class="p-2 text-right">{{ t('forecast.income') }}</th>
                <th class="p-2 text-right">{{ t('forecast.expenses') }}</th>
                <th class="p-2 text-right">{{ t('forecast.balance') }}</th>
                <th class="p-2 text-right">{{ t('forecast.cumulative') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 whitespace-nowrap">
              <tr v-for="row in finance.forecastRows" :key="row.month">
                <td class="p-2 font-medium">{{ month(row.month, 'short') }}</td>
                <td class="p-2 text-right text-emerald-600" :class="{ italic: row.incomeEstimated }">{{ money(row.income) }}</td>
                <td class="p-2 text-right text-rose-600">{{ money(row.expenses) }}</td>
                <td class="p-2 text-right font-bold" :class="row.balance >= 0 ? 'text-blue-600' : 'text-rose-600'">{{ money(row.balance) }}</td>
                <td class="p-2 text-right" :class="row.cumulative >= 0 ? 'text-slate-700' : 'text-rose-600'">{{ money(row.cumulative) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
