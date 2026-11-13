<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import type { SavingsGoal } from '@/types/models'
import { calculateRemainingAmount } from '@/domain/savings'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useFormat } from '@/i18n'
import { toCents } from '@/utils/money'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import SubmitButton from './SubmitButton.vue'

const props = defineProps<{ open: boolean; goal: SavingsGoal | null }>()
const emit = defineEmits<{ close: [] }>()

const formId = useId()
const { t, money, amountInput } = useFormat()
const finance = useFinanceStore()
const ui = useUiStore()

type ActionType = 'deposit' | 'withdraw'

const form = reactive({
  action: 'deposit' as ActionType,
  amount: '',
})

const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const error = ref('')

const remaining = computed(() => (props.goal ? calculateRemainingAmount(props.goal) : 0))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    form.action = 'deposit'
    form.amount = ''
    resetDirty()
  },
  { immediate: true },
)

function setAction(a: ActionType) {
  form.action = a
  error.value = ''
}

function setQuickAmount(cents: number) {
  form.amount = amountInput(cents)
}

function addQuickAmount(cents: number) {
  const current = toCents(form.amount) ?? 0
  form.amount = amountInput(current + cents)
}

function submit() {
  const cents = toCents(form.amount)
  if (!props.goal) return
  if (cents === null || cents <= 0) {
    error.value = t('savings.invalidAmount')
    return
  }

  if (form.action === 'withdraw' && cents > props.goal.currentAmount) {
    error.value = t('savings.withdrawExceeds', { max: money(props.goal.currentAmount) })
    return
  }

  const delta = form.action === 'deposit' ? cents : -cents
  finance.adjustSavingsGoalAmount(props.goal.id, delta)
  if (form.action === 'deposit') {
    ui.toast(t('savings.quickDepositSuccess', { amount: money(cents), name: props.goal.name }))
  } else {
    ui.toast(t('savings.quickWithdrawSuccess', { amount: money(cents), name: props.goal.name }))
  }
  emit('close')
}
</script>

<template>
  <BaseModal
    :open="open"
    :dirty="dirty"
    :form-id="formId"
    :title="`${t('savings.depositOrWithdraw')} · ${goal?.name ?? ''}`"
    @close="emit('close')"
  >
    <form :id="formId" class="space-y-4" @submit.prevent="submit">
      <!-- Info stato attuale -->
      <div v-if="goal" class="rounded-lg bg-surface-2 p-3 text-xs space-y-1">
        <div class="flex justify-between text-ink-3">
          <span>{{ t('savings.currentAmount') }}:</span>
          <span class="font-bold text-ink-strong">{{ money(goal.currentAmount) }}</span>
        </div>
        <div class="flex justify-between text-ink-3">
          <span>{{ t('savings.targetAmount') }}:</span>
          <span class="font-bold text-ink-strong">{{ money(goal.targetAmount) }}</span>
        </div>
        <div v-if="remaining > 0" class="flex justify-between text-accent">
          <span>{{ t('savings.remainingLabel') }}:</span>
          <span class="font-semibold">{{ money(remaining) }}</span>
        </div>
        <div v-else-if="goal.currentAmount >= goal.targetAmount" class="flex items-center gap-1 font-semibold text-accent pt-0.5">
          <i class="fa-solid fa-champagne-glasses text-[11px]"></i>
          <span>{{ t('savings.completedNotice') }}</span>
        </div>
      </div>

      <!-- Selettore operazione -->
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors border"
          :class="
            form.action === 'deposit'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line-soft bg-surface text-ink-3 hover:bg-surface-2'
          "
          @click="setAction('deposit')"
        >
          <i class="fa-solid fa-arrow-down text-xs"></i>
          {{ t('savings.deposit') }}
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors border"
          :class="
            form.action === 'withdraw'
              ? 'border-negative bg-negative-soft text-negative'
              : 'border-line-soft bg-surface text-ink-3 hover:bg-surface-2'
          "
          @click="setAction('withdraw')"
        >
          <i class="fa-solid fa-arrow-up text-xs"></i>
          {{ t('savings.withdraw') }}
        </button>
      </div>

      <!-- Importo -->
      <label class="block">
        <span class="field-label">{{ t('common.amount') }}</span>
        <input
          v-model="form.amount"
          required
          inputmode="decimal"
          class="field text-lg font-semibold"
          placeholder="0,00"
          autofocus
        />
      </label>

      <!-- Chip importi rapidi -->
      <div v-if="form.action === 'deposit'" class="flex flex-wrap items-center gap-1.5 pt-0.5">
        <button
          type="button"
          class="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-4 transition-colors"
          @click="addQuickAmount(1000)"
        >
          +10 €
        </button>
        <button
          type="button"
          class="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-4 transition-colors"
          @click="addQuickAmount(5000)"
        >
          +50 €
        </button>
        <button
          type="button"
          class="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-4 transition-colors"
          @click="addQuickAmount(10000)"
        >
          +100 €
        </button>
        <button
          v-if="remaining > 0"
          type="button"
          class="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft/80 transition-colors"
          @click="setQuickAmount(remaining)"
        >
          {{ t('savings.fillRemaining') }} ({{ money(remaining) }})
        </button>
      </div>

      <div v-else-if="goal && goal.currentAmount > 0" class="flex flex-wrap items-center gap-1.5 pt-0.5">
        <button
          v-if="goal.currentAmount >= 1000"
          type="button"
          class="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-4 transition-colors"
          @click="addQuickAmount(1000)"
        >
          +10 €
        </button>
        <button
          v-if="goal.currentAmount >= 5000"
          type="button"
          class="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-4 transition-colors"
          @click="addQuickAmount(5000)"
        >
          +50 €
        </button>
        <button
          type="button"
          class="rounded-full bg-negative-soft px-2.5 py-1 text-xs font-semibold text-negative hover:bg-negative-soft/80 transition-colors"
          @click="setQuickAmount(goal.currentAmount)"
        >
          {{ t('savings.withdrawAll') }} ({{ money(goal.currentAmount) }})
        </button>
      </div>

      <p v-if="error" class="text-xs text-negative">{{ error }}</p>

      <div class="pt-2">
        <SubmitButton
          :label="form.action === 'deposit' ? t('savings.confirmDeposit') : t('savings.confirmWithdraw')"
          :cancel-label="t('common.cancel')"
          @cancel="emit('close')"
        />
      </div>
    </form>
  </BaseModal>
</template>
