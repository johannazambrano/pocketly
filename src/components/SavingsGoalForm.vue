<script setup lang="ts">
import { reactive, ref, useId, watch } from 'vue'
import { useFormat } from '@/i18n'
import type { SavingsGoal } from '@/types/models'
import { useFinanceStore } from '@/stores/finance'
import { toCents } from '@/utils/money'
import { addDays, todayIso } from '@/utils/dates'
import { pickUniqueColor } from '@/utils/colors'
import BaseModal from './BaseModal.vue'
import { useDirty } from '@/composables/useDirty'
import SubmitButton from './SubmitButton.vue'

const props = defineProps<{ open: boolean; item?: SavingsGoal | null; deletable?: boolean }>()
const emit = defineEmits<{ close: []; delete: [] }>()

const formId = useId()
const { t, amountInput } = useFormat()
const finance = useFinanceStore()

const PRESET_COLORS = [
  '#10b981', // Smeraldo / Verde
  '#3b82f6', // Blu
  '#f59e0b', // Ambra
  '#8b5cf6', // Viola
  '#ec4899', // Rosa
  '#06b6d4', // Ciano
  '#f97316', // Arancio
  '#14b8a6', // Teal
]

const form = reactive({
  name: '',
  targetAmount: '',
  currentAmount: '',
  targetDate: '',
  color: PRESET_COLORS[0]!,
  notes: '',
})

const { dirty, reset: resetDirty } = useDirty(form, () => props.open)
const error = ref('')

/** Data suggerita di default: circa 6 mesi da oggi se nuova voce */
function defaultTargetDate(): string {
  return addDays(todayIso(), 180)
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item
    error.value = ''
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
  if (!form.name.trim()) {
    error.value = t('savings.nameRequired')
    return
  }

  const target = toCents(form.targetAmount)
  if (target === null || target <= 0) {
    error.value = t('savings.invalidTarget')
    return
  }

  const current = form.currentAmount.trim() === '' ? 0 : toCents(form.currentAmount)
  if (current === null || current < 0) {
    error.value = t('savings.invalidCurrent')
    return
  }

  if (!form.targetDate) {
    error.value = t('savings.dateRequired')
    return
  }

  finance.saveSavingsGoal({
    id: props.item?.id,
    name: form.name.trim(),
    targetAmount: target,
    currentAmount: current,
    targetDate: form.targetDate,
    color: form.color,
    notes: form.notes.trim() || undefined,
  })

  emit('close')
}
</script>

<template>
  <BaseModal :open="open" :dirty="dirty" :form-id="formId" :title="t(item ? 'savings.edit' : 'savings.new')" @close="emit('close')">
    <form :id="formId" class="space-y-3" @submit.prevent="submit">
      <label class="block">
        <span class="field-label">{{ t('savings.name') }}</span>
        <input
          v-model="form.name"
          required
          maxlength="80"
          class="field"
          :placeholder="t('savings.namePlaceholder')"
        />
      </label>

      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="field-label">{{ t('savings.targetAmount') }}</span>
          <input
            v-model="form.targetAmount"
            required
            inputmode="decimal"
            class="field"
            placeholder="0,00"
          />
        </label>
        <label class="block">
          <span class="field-label">{{ t('savings.currentAmount') }}</span>
          <input
            v-model="form.currentAmount"
            inputmode="decimal"
            class="field"
            placeholder="0,00"
          />
        </label>
      </div>

      <label class="block">
        <span class="field-label">{{ t('savings.targetDate') }}</span>
        <input v-model="form.targetDate" type="date" required class="field" />
      </label>

      <div>
        <span class="field-label">{{ t('savings.color') }}</span>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <button
            v-for="c in PRESET_COLORS"
            :key="c"
            type="button"
            class="h-7 w-7 rounded-full transition-transform focus:scale-110"
            :class="form.color === c ? 'ring-2 ring-ink ring-offset-2 scale-110' : 'opacity-80 hover:opacity-100'"
            :style="{ backgroundColor: c }"
            :aria-label="c"
            @click="form.color = c"
          ></button>
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

      <p v-if="error" class="text-xs text-negative">{{ error }}</p>

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
