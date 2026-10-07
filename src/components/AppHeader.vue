<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const finance = useFinanceStore()
const ui = useUiStore()
</script>

<template>
  <header class="pt-safe sticky top-0 z-40 bg-slate-900 text-white shadow-md">
    <div class="mx-auto flex max-w-md items-center justify-between px-4 py-3">
      <div class="flex items-center gap-2">
        <h1 class="flex items-center gap-2 text-lg font-bold tracking-wide">
          <i class="fa-solid fa-wallet text-emerald-400"></i> {{ t('app.name') }}
        </h1>
        <select
          v-model.number="finance.selectedYear"
          :aria-label="t('app.year')"
          class="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-bold text-emerald-400 outline-none"
        >
          <option v-for="y in finance.years" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm shadow transition hover:bg-emerald-500"
        :aria-label="t('onetime.new')"
        @click="ui.quickAddOpen = true"
      >
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>
  </header>
</template>
