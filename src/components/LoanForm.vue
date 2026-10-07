<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Loan, LoanType } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { centsToInput, toCents } from '@/utils/money'
import { todayIso } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import SubmitButton from './SubmitButton.vue'

const props = defineProps<{ open: boolean; item?: Loan | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const finance = useFinanceStore()

const form = reactive({ name: '', amount: '', type: 'given' as LoanType, date: '', notes: '' })
const error = ref('')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    error.value = ''
    Object.assign(form, {
      name: i?.name ?? '',
      amount: i ? centsToInput(i.amount) : '',
      type: i?.type ?? 'given',
      date: i?.date ?? todayIso(),
      notes: i?.notes ?? '',
    })
  },
  { immediate: true },
)

function submit() {
  const amount = toCents(form.amount)
  if (amount === null || amount <= 0) {
    error.value = t('common.invalidAmount')
    return
  }
  finance.saveLoan({
    id: props.item?.id,
    name: form.name.trim(),
    amount,
    type: form.type,
    date: form.date,
    notes: form.notes.trim(),
  })
  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :title="t(item ? 'loans.edit' : 'loans.new')" @close="emit('close')">
    <form class="space-y-3" @submit.prevent="submit">
      <label class="block">
        <span class="field-label">{{ t('loans.counterparty') }}</span>
        <input v-model="form.name" required maxlength="80" class="field" :placeholder="t('loans.counterpartyPlaceholder')" />
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="field-label">{{ t('loans.totalAmount') }}</span>
          <input v-model="form.amount" required inputmode="decimal" class="field" placeholder="0,00" />
        </label>
        <label class="block">
          <span class="field-label">{{ t('loans.type') }}</span>
          <select v-model="form.type" class="field">
            <option value="given">{{ t('loans.given') }}</option>
            <option value="received">{{ t('loans.received') }}</option>
          </select>
        </label>
      </div>
      <label class="block">
        <span class="field-label">{{ t('common.date') }}</span>
        <input v-model="form.date" type="date" required class="field" />
      </label>
      <label class="block">
        <span class="field-label">{{ t('common.notes') }}</span>
        <input v-model="form.notes" maxlength="200" class="field" :placeholder="t('loans.notesPlaceholder')" />
      </label>
      <p v-if="error" class="text-xs text-rose-600">{{ error }}</p>
      <div class="pt-2"><SubmitButton :label="t('common.save')" /></div>
    </form>
  </BaseModal>
</template>
