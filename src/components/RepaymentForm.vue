<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Loan } from '@/types/models'
import { loanStatus } from '@/domain/calculations'
import { useFinanceStore } from '@/stores/finance'
import { useFormat } from '@/i18n'
import { centsToInput, toCents } from '@/utils/money'
import { todayIso } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'

const props = defineProps<{ open: boolean; loan: Loan | null }>()
const emit = defineEmits<{ close: [] }>()
const { t, money } = useFormat()
const finance = useFinanceStore()

const form = reactive({ amount: '', date: '' })
const error = ref('')
const remaining = computed(() => (props.loan ? loanStatus(props.loan).remaining : 0))
const exceeds = computed(() => {
  const amount = toCents(form.amount)
  return amount !== null && amount > remaining.value
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    form.amount = remaining.value > 0 ? centsToInput(remaining.value) : ''
    form.date = todayIso()
  },
  { immediate: true },
)

function submit() {
  const amount = toCents(form.amount)
  if (!props.loan) return
  if (amount === null || amount <= 0) {
    error.value = t('common.invalidAmount')
    return
  }
  finance.addRepayment(props.loan.id, { amount, date: form.date })
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :title="`${t('loans.newRepayment')} · ${loan?.name ?? ''}`" @close="emit('close')">
    <form class="space-y-3" @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="field-label">{{ t('common.amount') }}</span>
          <input v-model="form.amount" required inputmode="decimal" class="field" placeholder="0,00" />
        </label>
        <label class="block">
          <span class="field-label">{{ t('common.date') }}</span>
          <input v-model="form.date" type="date" required class="field" />
        </label>
      </div>
      <p v-if="exceeds" class="text-xs text-amber-700">{{ t('loans.exceedsRemaining', { amount: money(remaining) }) }}</p>
      <p v-if="error" class="text-xs text-rose-600">{{ error }}</p>
      <div class="pt-2"><SubmitButton :label="t('common.save')" /></div>
    </form>
  </BaseModal>
</template>
