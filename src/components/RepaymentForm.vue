<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import type { Loan } from '@/types/models'
import { loanStatus } from '@/domain/calculations'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { toCents } from '@/utils/money'
import { todayIso } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import SubmitButton from './SubmitButton.vue'
import FieldError from './FieldError.vue'
import { useFormErrors } from '@/composables/useFormErrors'

const props = defineProps<{ open: boolean; loan: Loan | null }>()
const emit = defineEmits<{ close: [] }>()
/** L'id del modulo: su iPhone "Fine" nella barra del foglio lo invia. */
const formId = useId()
const { t, money, amountInput } = useFormat()
const finance = useFinanceStore()

const form = reactive({ amount: '', date: '' })
/** Modifiche non salvate: la finestra le protegge da una chiusura per sbaglio. */
const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const fe = useFormErrors(form)
const formEl = ref<HTMLFormElement | null>(null)
const remaining = computed(() => (props.loan ? loanStatus(props.loan).remaining : 0))
const exceeds = computed(() => {
  const amount = toCents(form.amount)
  return amount !== null && amount > remaining.value
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    fe.clear()
    form.amount = remaining.value > 0 ? amountInput(remaining.value) : ''
    form.date = todayIso()
    resetDirty()
  },
  { immediate: true },
)

function submit() {
  if (!props.loan) return
  fe.clear()
  const amount = fe.amount('amount', form.amount)
  fe.required('date', form.date, t('form.dateEmpty'))
  if (amount === null || fe.hasErrors()) {
    fe.focusFirst(formEl.value)
    return
  }
  finance.addRepayment(props.loan.id, { amount, date: form.date })
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="formId" :title="`${t('loans.newRepayment')} · ${loan?.name ?? ''}`" @close="emit('close')">
    <form :id="formId" ref="formEl" novalidate class="space-y-3" @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="field-label">{{ t('common.amount') }}</span>
          <input v-model="form.amount" v-bind="fe.attrs('amount')" inputmode="decimal" autocomplete="off" class="field" placeholder="0,00" />
          <FieldError :id="fe.errorId('amount')" :message="fe.errors.amount" />
        </label>
        <label class="block">
          <span class="field-label">{{ t('common.date') }}</span>
          <input v-model="form.date" v-bind="fe.attrs('date')" type="date" class="field" />
          <FieldError :id="fe.errorId('date')" :message="fe.errors.date" />
        </label>
      </div>
      <p v-if="exceeds" class="text-xs text-caution">{{ t('loans.exceedsRemaining', { amount: money(remaining) }) }}</p>
      <div class="pt-2"><SubmitButton :label="t('common.save')" :cancel-label="t('common.cancel')" @cancel="emit('close')" /></div>
    </form>
  </BaseModal>
</template>
