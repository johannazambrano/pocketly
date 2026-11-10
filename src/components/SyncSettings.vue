<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFormat } from '@/i18n'
import { MIN_PASSWORD_LENGTH } from '@/services/backupCrypto'
import { useSyncStore } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'
import { useFinanceStore } from '@/stores/finance'
import { useNotificationsStore } from '@/stores/notifications'
import type { FinanceData } from '@/types/models'
import BaseModal from '@/components/BaseModal.vue'

const sync = useSyncStore()
const finance = useFinanceStore()
const notifications = useNotificationsStore()
const ui = useUiStore()
const { t, locale } = useFormat()

const showForm = ref(false)
const serverKey = ref('')
const password = ref('')
const passwordRepeat = ref('')
const busy = ref(false)
const formProblem = ref('')

const passwordProblem = computed(() => {
  if (password.value.length < MIN_PASSWORD_LENGTH) return t('settings.passwordTooShort', { min: MIN_PASSWORD_LENGTH })
  if (password.value !== passwordRepeat.value) return t('settings.passwordMismatch')
  return ''
})
const canConnect = computed(() => !!serverKey.value.trim() && !passwordProblem.value && !busy.value)

const lastSyncText = computed(() => {
  if (!sync.lastSyncedAt) return ''
  const when = new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sync.lastSyncedAt))
  return t('sync.lastSync', { when })
})

function openForm() {
  serverKey.value = sync.serverKey
  password.value = ''
  passwordRepeat.value = ''
  formProblem.value = ''
  showForm.value = true
}

async function connect() {
  if (!canConnect.value) return
  busy.value = true
  formProblem.value = ''
  try {
    // Ricollegare (es. password cambiata altrove) riparte da zero, come un primo collegamento.
    if (sync.enabled) await sync.disconnect()
    const outcome = await sync.connect(serverKey.value.trim(), password.value)
    if (outcome === 'done') {
      showForm.value = false
      ui.toast(t('sync.connected'))
    }
    password.value = ''
    passwordRepeat.value = ''
  } catch (e) {
    formProblem.value = t(`sync.problem.${sync.problemOf(e)}`)
  } finally {
    busy.value = false
  }
}

async function choose(source: 'server' | 'device') {
  busy.value = true
  try {
    await sync.choose(source)
    showForm.value = false
    ui.toast(t('sync.connected'))
  } catch (e) {
    sync.cancelChoice()
    formProblem.value = t(`sync.problem.${sync.problemOf(e)}`)
  } finally {
    busy.value = false
  }
}

async function disconnect() {
  const ok = await ui.confirm({
    title: t('sync.disconnectTitle'),
    message: t('sync.disconnectText'),
    confirmLabel: t('sync.disconnectButton'),
  })
  if (!ok) return
  // Prima di dimenticare la chiave del server, si tolgono da lì iscrizione e promemoria di questo dispositivo.
  await notifications.leaveServer()
  await sync.disconnect()
}

const entries = (d: FinanceData) => d.oneTimeExpenses.length + d.recurringExpenses.length + d.incomes.length + d.loans.length
</script>

<template>
  <div v-if="sync.available !== null" class="card space-y-3">
    <h3 class="text-sm font-semibold text-slate-700">
      <i class="fa-solid fa-cloud mr-1 text-sky-600"></i> {{ t('sync.title') }}
    </h3>

    <p v-if="!sync.available" class="text-xs text-slate-500">{{ t('sync.unavailable') }}</p>
    <p v-else-if="!sync.cryptoAvailable" class="text-xs text-amber-700">{{ t('sync.needsHttps') }}</p>

    <template v-else>
      <p class="text-xs text-slate-500">{{ t('sync.hint') }}</p>

      <div v-if="sync.enabled && !showForm" class="space-y-3">
        <div class="rounded-lg bg-slate-50 px-3 py-2 text-xs" role="status">
          <p class="font-medium" :class="sync.status === 'error' ? 'text-rose-700' : sync.status === 'offline' ? 'text-amber-700' : 'text-slate-700'">
            {{ t(`sync.status.${sync.status}`) }}
          </p>
          <p v-if="sync.problem && sync.problem !== 'offline'" class="text-rose-700">{{ t(`sync.problem.${sync.problem}`) }}</p>
          <p v-if="lastSyncText" class="text-slate-500">{{ lastSyncText }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="sync.problem === 'password' || sync.problem === 'serverKey'"
            type="button"
            class="btn-primary min-w-40 flex-1"
            @click="openForm"
          >
            {{ t('sync.reconnect') }}
          </button>
          <button v-else type="button" class="btn-primary min-w-40 flex-1" :disabled="sync.status === 'syncing'" @click="sync.syncNow()">
            {{ t('sync.syncNow') }}
          </button>
          <button
            type="button"
            class="min-h-10 min-w-40 flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            @click="disconnect"
          >
            {{ t('sync.disconnect') }}
          </button>
        </div>
      </div>

      <button v-else-if="!showForm" type="button" class="btn-primary w-full" @click="openForm">{{ t('sync.connect') }}</button>

      <form v-else class="space-y-2" @submit.prevent="connect">
        <input
          v-model="serverKey"
          type="password"
          autocomplete="off"
          class="field"
          :placeholder="t('sync.serverKey')"
          :aria-label="t('sync.serverKey')"
        />
        <p class="text-xs text-slate-500">{{ t('sync.serverKeyHint') }}</p>
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          class="field"
          :placeholder="t('sync.password', { min: MIN_PASSWORD_LENGTH })"
          :aria-label="t('sync.password', { min: MIN_PASSWORD_LENGTH })"
        />
        <input
          v-model="passwordRepeat"
          type="password"
          autocomplete="new-password"
          class="field"
          :placeholder="t('sync.passwordRepeat')"
          :aria-label="t('sync.passwordRepeat')"
        />
        <p v-if="passwordRepeat && passwordProblem" class="text-xs text-rose-600">{{ passwordProblem }}</p>
        <p class="text-xs text-amber-700"><i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('sync.passwordHint') }}</p>
        <p v-if="formProblem" class="text-xs text-rose-600" role="alert">{{ formProblem }}</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="min-h-10 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            @click="showForm = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn-primary flex-1" :disabled="!canConnect">
            {{ busy ? t('sync.connecting') : t('sync.connect') }}
          </button>
        </div>
      </form>
    </template>

    <BaseModal :open="!!sync.pendingChoice" :title="t('sync.chooseTitle')" @close="busy || sync.cancelChoice()">
      <div v-if="sync.pendingChoice" class="space-y-3 text-sm">
        <p class="text-slate-600">{{ t('sync.chooseText') }}</p>
        <p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <i class="fa-solid fa-triangle-exclamation mr-1"></i>{{ t('sync.chooseWarning') }}
        </p>
        <button
          type="button"
          class="w-full rounded-lg border border-slate-300 px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
          :disabled="busy"
          @click="choose('server')"
        >
          <span class="block font-semibold text-slate-800">{{ t('sync.useServer') }}</span>
          <span class="block text-xs text-slate-500">
            {{ t('sync.sourceServer') }}: {{ t('sync.chooseCounts', { entries: entries(sync.pendingChoice.result.remote) }) }}
          </span>
          <span class="block text-xs text-rose-700">{{ t('sync.useServerHint') }}</span>
        </button>
        <button
          type="button"
          class="w-full rounded-lg border border-slate-300 px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-50"
          :disabled="busy"
          @click="choose('device')"
        >
          <span class="block font-semibold text-slate-800">{{ t('sync.useDevice') }}</span>
          <span class="block text-xs text-slate-500">
            {{ t('sync.sourceDevice') }}: {{ t('sync.chooseCounts', { entries: entries(finance.data) }) }}
          </span>
          <span class="block text-xs text-rose-700">{{ t('sync.useDeviceHint') }}</span>
        </button>
        <button
          type="button"
          class="min-h-10 w-full rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
          :disabled="busy"
          @click="sync.cancelChoice()"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
    </BaseModal>
  </div>
</template>
