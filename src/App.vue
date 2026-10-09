<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
import ConfirmHost from '@/components/ConfirmHost.vue'
import ToastHost from '@/components/ToastHost.vue'
import UpdatePrompt from '@/components/UpdatePrompt.vue'
import TransactionForm from '@/components/TransactionForm.vue'

const { t } = useI18n()
const finance = useFinanceStore()
const ui = useUiStore()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <div v-if="finance.saveError" class="bg-rose-600 px-4 py-2 text-center text-xs text-white">{{ t('app.saveError') }}</div>
    <div class="px-safe w-full flex-grow">
      <!-- Telefono: una colonna. Tablet e PC: menu a sinistra e contenuto largo a destra. -->
      <div class="mx-auto flex w-full max-w-xl md:max-w-6xl md:gap-6 md:px-6 md:py-6">
        <main class="min-w-0 flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-0">
          <p v-if="!finance.ready" class="py-10 text-center text-sm text-slate-400">{{ t('app.loading') }}</p>
          <RouterView v-else />
        </main>
        <BottomNav />
      </div>
    </div>
  </div>
  <TransactionForm :open="ui.quickAddOpen" kind="expense" @close="ui.quickAddOpen = false" />
  <ConfirmHost />
  <ToastHost />
  <UpdatePrompt />
</template>
