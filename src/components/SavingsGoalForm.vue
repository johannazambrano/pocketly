<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { SavedGoal } from '@/domain/savings'
import { useFinanceStore } from '@/stores/finance'
import { amountProblem, toCents } from '@/utils/money'
import { addDays, todayIso } from '@/utils/dates'
import { PALETTE, pickUniqueColor } from '@/utils/colors'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import SubmitButton from './SubmitButton.vue'
import FieldError from './FieldError.vue'
import { useFormErrors } from '@/composables/useFormErrors'

const props = defineProps<{ open: boolean; item?: SavedGoal | null; deletable?: boolean }>()
const emit = defineEmits<{ close: []; delete: [] }>()

const formId = useId()
const { t, amountInput } = useFormat()
const finance = useFinanceStore()

const form = reactive({
  name: '',
  targetAmount: '',
  currentAmount: '',
  targetDate: '',
  color: PALETTE[0]!,
  notes: '',
})

const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const fe = useFormErrors(form)
const formEl = ref<HTMLFormElement | null>(null)
/**
 * I colori tra cui scegliere: la tavolozza dell'app (la stessa di categorie e tag, senza il verde delle azioni né i
 * rossi). Un colore di un salvadanaio più vecchio che non ne fa parte resta in testa, così si vede quello scelto.
 */
const colors = computed(() => (PALETTE.includes(form.color) || !form.color ? PALETTE : [form.color, ...PALETTE]))
/** Importo accantonato quando il modulo è stato aperto: al salvataggio si registra solo la differenza. */
let openedAmount = 0

/** Data suggerita di default: circa 6 mesi da oggi se nuova voce */
function defaultTargetDate(): string {
  return addDays(todayIso(), 180)
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    fe.clear()
    openedAmount = i?.currentAmount ?? 0
    const existingColors = finance.savingsGoals.map((g) => g.color ?? '')
    Object.assign(form, {
      name: i?.name ?? '',
      targetAmount: i ? amountInput(i.targetAmount) : '',
      currentAmount: i ? (i.currentAmount > 0 ? amountInput(i.currentAmount) : '') : '',
      targetDate: i?.targetDate ?? defaultTargetDate(),
      color: i?.color ?? pickUniqueColor(existingColors),
      notes: i?.notes ?? '',
    })
    resetDirty()
  },
  { immediate: true },
)

function submit() {
  fe.clear()
  fe.required('name', form.name, t('savings.nameRequired'))
  const target = fe.amount('targetAmount', form.targetAmount)
  // L'importo già accantonato può restare vuoto (= zero), ma se c'è dev'essere un importo valido.
  let current: number | null = 0
  if (form.currentAmount.trim() !== '') {
    current = toCents(form.currentAmount)
    if (current === null || current < 0) {
      fe.set('currentAmount', amountProblem(form.currentAmount) === 'unreadable'
        ? t('form.amountUnreadable', { value: form.currentAmount.trim() })
        : t('savings.invalidCurrent'))
    }
  }
  fe.required('targetDate', form.targetDate, t('savings.dateRequired'))
  if (target === null || current === null || fe.hasErrors()) {
    void fe.focusFirst(formEl.value)
    return
  }

  finance.saveSavingsGoal(
    {
      id: props.item?.id,
      name: form.name.trim(),
      targetAmount: target,
      targetDate: form.targetDate,
      color: form.color,
      notes: form.notes.trim() || undefined,
    },
    current - openedAmount,
  )

  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="formId" :title="t(item ? 'savings.edit' : 'savings.new')" @close="emit('close')">
    <form :id="formId" ref="formEl" novalidate class="space-y-3" @submit.prevent="submit">
      <label class="block">
        <span class="field-label">{{ t('savings.name') }}</span>
        <input
          v-model="form.name"
          v-bind="fe.attrs('name')"
          maxlength="80"
          class="field"
          :placeholder="t('savings.namePlaceholder')"
        />
        <FieldError :id="fe.errorId('name')" :message="fe.errors.name" />
      </label>

      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="field-label">{{ t('savings.targetAmount') }}</span>
          <input
            v-model="form.targetAmount"
            v-bind="fe.attrs('targetAmount')"
            inputmode="decimal"
            autocomplete="off"
            class="field"
            placeholder="0,00"
          />
          <FieldError :id="fe.errorId('targetAmount')" :message="fe.errors.targetAmount" />
        </label>
        <label class="block">
          <span class="field-label">{{ t('savings.currentAmount') }}</span>
          <input
            v-model="form.currentAmount"
            v-bind="fe.attrs('currentAmount')"
            inputmode="decimal"
            autocomplete="off"
            class="field"
            placeholder="0,00"
          />
          <FieldError :id="fe.errorId('currentAmount')" :message="fe.errors.currentAmount" />
        </label>
      </div>

      <label class="block">
        <span class="field-label">{{ t('savings.targetDate') }}</span>
        <input v-model="form.targetDate" v-bind="fe.attrs('targetDate')" type="date" class="field" />
        <FieldError :id="fe.errorId('targetDate')" :message="fe.errors.targetDate" />
      </label>

      <div role="group" :aria-labelledby="`${formId}-color`">
        <span :id="`${formId}-color`" class="field-label">{{ t('savings.color') }}</span>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <button
            v-for="(c, i) in colors"
            :key="c"
            type="button"
            class="grid h-9 w-9 place-items-center rounded-full"
            :aria-label="t('savings.colorOption', { n: i + 1, total: colors.length })"
            :aria-pressed="form.color === c"
            @click="form.color = c"
          >
            <span
              class="h-7 w-7 rounded-full transition-transform"
              :class="form.color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''"
              :style="{ backgroundColor: c }"
            ></span>
          </button>
        </div>
      </div>

      <label class="block">
        <span class="field-label">{{ t('common.notes') }}</span>
        <input
          v-model="form.notes"
          maxlength="200"
          class="field"
          :placeholder="t('savings.notesPlaceholder')"
        />
      </label>

      <div class="pt-2">
        <SubmitButton
          :label="t('common.save')"
          :cancel-label="t('common.cancel')"
          :delete-label="deletable ? t('common.delete') : undefined"
          @cancel="emit('close')"
          @delete="emit('delete')"
        />
      </div>
    </form>
  </BaseModal>
</template>
