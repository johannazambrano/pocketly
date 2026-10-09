<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const finance = useFinanceStore()
const ui = useUiStore()
</script>

<template>
  <header class="pt-safe px-safe sticky top-0 z-40 bg-slate-900 text-white shadow-md">
    <div class="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3 md:max-w-6xl md:px-6">
      <div class="flex min-w-0 items-center gap-2">
        <h1 class="flex items-center gap-2 text-lg font-bold tracking-wide">
          <i class="fa-solid fa-wallet text-emerald-400"></i> {{ t('app.name') }}
        </h1>
        <select
          v-model.number="finance.selectedYear"
          :aria-label="t('app.year')"
          class="h-10 rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm font-bold text-emerald-400 outline-none"
        >
          <option v-for="y in finance.years" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <button
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-base shadow transition hover:bg-emerald-500"
        :aria-label="t('onetime.new')"
        @click="ui.quickAddOpen = true"
      >
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>
  </header>
</template>
