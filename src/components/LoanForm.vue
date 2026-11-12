<script setup lang="ts">
import { reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { Loan, LoanType } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { todayIso } from '@/utils/dates'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import SubmitButton from './SubmitButton.vue'
import FieldError from './FieldError.vue'
import { useFormErrors } from '@/composables/useFormErrors'

/** `deletable`: modifica di una voce esistente da una pagina che sa eliminarla; mostra "Elimina" ed emette `delete`. */
const props = defineProps<{ open: boolean; item?: Loan | null; deletable?: boolean }>()
const emit = defineEmits<{ close: []; delete: [] }>()
/** L'id del modulo: su iPhone "Fine" nella barra del foglio lo invia. */
const formId = useId()
const { t, amountInput } = useFormat()
const finance = useFinanceStore()

const form = reactive({ name: '', amount: '', type: 'given' as LoanType, date: '', notes: '' })
/** Modifiche non salvate: la finestra le protegge da una chiusura per sbaglio. */
const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const fe = useFormErrors(form)
const formEl = ref<HTMLFormElement | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    fe.clear()
    Object.assign(form, {
      name: i?.name ?? '',
      amount: i ? amountInput(i.amount) : '',
      type: i?.type ?? 'given',
      date: i?.date ?? todayIso(),
      notes: i?.notes ?? '',
    })
    resetDirty()
  },
  { immediate: true },
)

function submit() {
  fe.clear()
  fe.required('name', form.name, t('form.counterpartyEmpty'))
  const amount = fe.amount('amount', form.amount)
  fe.required('date', form.date, t('form.dateEmpty'))
  if (amount === null || fe.hasErrors()) {
    fe.focusFirst(formEl.value)
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
  <BaseModal :open="open" :dirty="dirty" :form-id="formId" :title="t(item ? 'loans.edit' : 'loans.new')" @close="emit('close')">
    <form :id="formId" ref="formEl" novalidate class="space-y-3" @submit.prevent="submit">
      <label class="block">
        <span class="field-label">{{ t('loans.counterparty') }}</span>
        <input v-model="form.name" v-bind="fe.attrs('name')" maxlength="80" class="field" :placeholder="t('loans.counterpartyPlaceholder')" />
        <FieldError :id="fe.errorId('name')" :message="fe.errors.name" />
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="field-label">{{ t('loans.totalAmount') }}</span>
          <input v-model="form.amount" v-bind="fe.attrs('amount')" inputmode="decimal" autocomplete="off" class="field" placeholder="0,00" />
          <FieldError :id="fe.errorId('amount')" :message="fe.errors.amount" />
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
        <input v-model="form.date" v-bind="fe.attrs('date')" type="date" class="field" />
        <FieldError :id="fe.errorId('date')" :message="fe.errors.date" />
      </label>
      <label class="block">
        <span class="field-label">{{ t('common.notes') }}</span>
        <input v-model="form.notes" maxlength="200" class="field" :placeholder="t('loans.notesPlaceholder')" />
      </label>
      <div class="pt-2"><SubmitButton
          :label="t('common.save')"
          :cancel-label="t('common.cancel')"
          :delete-label="deletable ? t('common.delete') : undefined"
          @cancel="emit('close')"
          @delete="emit('delete')"
        /></div>
    </form>
  </BaseModal>
</template>
