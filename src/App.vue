<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useAppearanceStore } from '@/stores/appearance'
import AppHeader from '@/components/AppHeader.vue'
import BackupReminder from '@/components/BackupReminder.vue'
import BottomNav from '@/components/BottomNav.vue'
import ConfirmHost from '@/components/ConfirmHost.vue'
import ToastHost from '@/components/ToastHost.vue'
import UpdatePrompt from '@/components/UpdatePrompt.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import LoadErrorScreen from '@/components/LoadErrorScreen.vue'

const { t } = useI18n()
const finance = useFinanceStore()
const ui = useUiStore()
const appearance = useAppearanceStore()
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <div v-if="finance.saveError" class="bg-negative-fill px-4 py-2 text-center text-xs text-on-color">{{ t('app.saveError') }}</div>
    <div class="px-safe w-full flex-grow">
      <!-- Telefono: una colonna. Tablet e PC: menu a sinistra e contenuto largo a destra. -->
      <div class="mx-auto flex w-full max-w-xl md:max-w-6xl md:gap-6 md:px-6 md:py-6">
        <!-- Su Android il "+" flottante sta sopra la barra in basso: più spazio in fondo, così non copre l'ultima riga. -->
        <main
          class="min-w-0 flex-1 p-4 md:p-0"
          :class="appearance.platform === 'android' ? 'pb-[calc(10rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6rem+env(safe-area-inset-bottom))]'"
        >
          <p v-if="!finance.ready" class="py-10 text-center text-sm text-ink-4">{{ t('app.loading') }}</p>
          <LoadErrorScreen v-else-if="finance.loadError" />
          <template v-else>
            <BackupReminder />
            <RouterView />
          </template>
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
