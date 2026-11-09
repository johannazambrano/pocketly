<script setup lang="ts">
import { ref } from 'vue'
import { useFormat } from '@/i18n'
import TransactionForm from '@/components/TransactionForm.vue'
import RecurringForm from '@/components/RecurringForm.vue'

/**
 * Il primo avvio: l'app è vuota e la dashboard non avrebbe nulla da dire. Invece di saldi a zero, spiega in due righe
 * cosa fa l'app e propone i tre modi più rapidi per cominciare. Sparisce da sola appena c'è il primo dato.
 */
const { t } = useFormat()
const incomeOpen = ref(false)
const recurringOpen = ref(false)

const secondary =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100'
</script>

<template>
  <section class="card space-y-4 p-5 md:p-6" aria-labelledby="welcome-title">
    <div class="space-y-2">
      <h3 id="welcome-title" class="text-lg font-bold text-slate-800">{{ t('welcome.title') }}</h3>
      <p class="max-w-prose text-sm text-slate-600">{{ t('welcome.intro') }}</p>
      <p class="max-w-prose text-sm text-slate-600">{{ t('welcome.start') }}</p>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <button type="button" class="btn-primary gap-2" @click="incomeOpen = true">
        <i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i>{{ t('welcome.addIncome') }}
      </button>
      <button type="button" :class="secondary" @click="recurringOpen = true">
        <i class="fa-solid fa-rotate" aria-hidden="true"></i>{{ t('welcome.addRecurring') }}
      </button>
      <RouterLink to="/impostazioni" :class="secondary">
        <i class="fa-solid fa-file-import" aria-hidden="true"></i>{{ t('welcome.import') }}
      </RouterLink>
    </div>

    <p class="text-xs text-slate-500">{{ t('welcome.dailyHint') }}</p>
  </section>

  <TransactionForm :open="incomeOpen" kind="income" @close="incomeOpen = false" />
  <RecurringForm :open="recurringOpen" @close="recurringOpen = false" />
</template>
