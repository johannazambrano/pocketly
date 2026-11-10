<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { NotificationRule } from '@/types/models'
import { useNotificationsStore } from '@/stores/notifications'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import NotificationRulesEditor from './NotificationRulesEditor.vue'

const { t } = useI18n()
const notifications = useNotificationsStore()
const finance = useFinanceStore()
const ui = useUiStore()

async function handleEnable() {
  const ok = await notifications.enable()
  if (ok) {
    ui.toast(t('notifications.enabledToast'))
  } else if (notifications.permission === 'denied') {
    ui.toast(t('notifications.permissionDenied'), 'error')
  }
}

async function handleDisable() {
  await notifications.disable()
  ui.toast(t('notifications.disabledToast'))
}

async function handleSendTest() {
  const ok = await notifications.sendTestNotification()
  if (ok) {
    ui.toast(t('notifications.testSent'))
  } else {
    ui.toast(t('notifications.testError'), 'error')
  }
}

function handleUpdateDefaultRules(rules: NotificationRule[]) {
  void notifications.setDefaultRules(rules)
}

function applyDefaults(mode: 'missing' | 'all') {
  const count = finance.applyNotificationsToRecurring(notifications.defaultRules, mode)
  ui.toast(t('notifications.appliedToast', { count }))
}
</script>

<template>
  <div class="card space-y-3">
    <h3 class="text-sm font-semibold text-slate-700">
      <i class="fa-solid fa-bell mr-1 text-emerald-600"></i>
      {{ t('notifications.title') }}
    </h3>
    <p class="text-xs text-slate-500">{{ t('notifications.settingsHint') }}</p>

    <!-- Supporto notifiche non disponibile -->
    <p v-if="!notifications.isSupported" class="text-xs text-amber-700">
      <i class="fa-solid fa-triangle-exclamation mr-1"></i>
      {{ t('notifications.unsupported') }}
    </p>

    <!-- Avviso iOS installazione su Home Screen -->
    <p v-if="notifications.iosInstallRequired" class="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
      <i class="fa-solid fa-circle-info mr-1 text-amber-600"></i>
      {{ t('notifications.iosInstallRequired') }}
    </p>

    <!-- Permessi bloccati nel browser -->
    <p v-if="notifications.permission === 'denied'" class="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
      <i class="fa-solid fa-triangle-exclamation mr-1 text-rose-600"></i>
      {{ t('notifications.permissionDenied') }}
    </p>

    <!-- Stato attivo -->
    <div v-if="notifications.enabled" class="space-y-3">
      <template v-if="notifications.isPushActive">
        <p class="text-xs font-medium text-emerald-700">
          <i class="fa-solid fa-check mr-1"></i>
          {{ t('notifications.modePush') }}
        </p>
        <p class="text-xs text-slate-600">{{ t('notifications.horizonHint') }}</p>
        <p v-if="notifications.scheduleProblem" class="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
          <i class="fa-solid fa-triangle-exclamation mr-1"></i>
          {{ t(notifications.scheduleProblem === 'tooMany' ? 'notifications.scheduleTooMany' : 'notifications.scheduleFailed') }}
        </p>
      </template>
      <p v-else class="text-xs text-slate-600">
        <i class="fa-solid fa-circle-info mr-1 text-indigo-600"></i>
        {{ t('notifications.modeLocalOnly') }}
      </p>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="min-h-10 min-w-40 flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="notifications.testSending"
          @click="handleSendTest"
        >
          {{ notifications.testSending ? t('common.loading') : t('notifications.testButton') }}
        </button>
        <button
          type="button"
          class="min-h-10 min-w-40 flex-1 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
          @click="handleDisable"
        >
          {{ t('notifications.disableDevice') }}
        </button>
      </div>
    </div>

    <!-- Stato disattivato -->
    <div v-else>
      <button
        type="button"
        class="btn-primary w-full"
        :disabled="!notifications.isSupported || notifications.permission === 'denied'"
        @click="handleEnable"
      >
        {{ t('notifications.enableDevice') }}
      </button>
    </div>

    <!-- Sezione regole predefinite per nuove ricorrenze -->
    <div class="space-y-2 border-t border-slate-100 pt-3">
      <h4 class="text-xs font-semibold text-slate-700">
        {{ t('notifications.defaultRulesTitle') }}
      </h4>
      <p class="text-xs text-slate-500">{{ t('notifications.defaultRulesHint') }}</p>

      <NotificationRulesEditor
        :model-value="notifications.defaultRules"
        @update:model-value="handleUpdateDefaultRules"
      />

      <div class="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          class="min-h-9 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="!finance.data.recurringExpenses.length"
          @click="applyDefaults('missing')"
        >
          {{ t('notifications.applyToMissing') }}
        </button>
        <button
          type="button"
          class="min-h-9 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="!finance.data.recurringExpenses.length"
          @click="applyDefaults('all')"
        >
          {{ t('notifications.applyToAll') }}
        </button>
      </div>
    </div>
  </div>
</template>
