<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NotificationRule } from '@/types/models'
import {
  DEFAULT_NOTIFICATION_RULE,
  MAX_DAYS_BEFORE,
  MAX_NOTIFICATION_RULES,
  PRESET_DAYS_BEFORE,
  isValidTime,
  nextCandidateRule,
  normalizeNotifications,
} from '@/domain/notifications'

interface EditableRule {
  uid: number
  daysBefore: number
  time: string
  isCustom: boolean
}

let uidCounter = 1

const props = withDefaults(
  defineProps<{
    modelValue?: NotificationRule[]
    showToggle?: boolean
    toggleLabel?: string
    disabled?: boolean
    defaultFallbackRules?: NotificationRule[]
  }>(),
  {
    modelValue: () => [],
    showToggle: false,
    toggleLabel: '',
    disabled: false,
    defaultFallbackRules: () => [{ ...DEFAULT_NOTIFICATION_RULE }],
  },
)

const emit = defineEmits<{
  'update:modelValue': [rules: NotificationRule[]]
}>()

const { t } = useI18n()

const PRESET_OPTIONS = [
  { value: 0, labelKey: 'notifications.presets.d0' },
  { value: 1, labelKey: 'notifications.presets.d1' },
  { value: 2, labelKey: 'notifications.presets.d2' },
  { value: 3, labelKey: 'notifications.presets.d3' },
  { value: 5, labelKey: 'notifications.presets.d5' },
  { value: 7, labelKey: 'notifications.presets.d7' },
  { value: 14, labelKey: 'notifications.presets.d14' },
  { value: 'custom', labelKey: 'notifications.customDays' },
] as const

const localRules = ref<EditableRule[]>([])
const isEnabled = ref(false)
let lastEmittedJson = ''

function isPreset(days: number): boolean {
  return (PRESET_DAYS_BEFORE as readonly number[]).includes(days)
}

function syncFromProps(val: NotificationRule[] | undefined) {
  const list = val ?? []
  isEnabled.value = list.length > 0
  localRules.value = list.map((r) => ({
    uid: uidCounter++,
    daysBefore: r.daysBefore,
    time: r.time,
    isCustom: !isPreset(r.daysBefore),
  }))
}

watch(
  () => props.modelValue,
  (val) => {
    const nextJson = JSON.stringify((val ?? []).map((r) => ({ daysBefore: r.daysBefore, time: r.time })))
    if (nextJson !== lastEmittedJson) {
      lastEmittedJson = nextJson
      syncFromProps(val)
    }
  },
  { immediate: true, deep: true },
)

function emitUpdate() {
  if (props.showToggle && !isEnabled.value) {
    lastEmittedJson = '[]'
    emit('update:modelValue', [])
    return
  }
  const cleaned: NotificationRule[] = []
  for (const r of localRules.value) {
    const days = Math.max(0, Math.min(MAX_DAYS_BEFORE, Math.floor(Number(r.daysBefore) || 0)))
    const time = isValidTime(r.time) ? r.time : '09:00'
    cleaned.push({ daysBefore: days, time })
  }
  const normalized = normalizeNotifications(cleaned)
  lastEmittedJson = JSON.stringify(normalized.map((r) => ({ daysBefore: r.daysBefore, time: r.time })))
  emit('update:modelValue', normalized)
}

function toggleEnabled(checked: boolean) {
  isEnabled.value = checked
  if (checked) {
    if (localRules.value.length === 0) {
      const fallback = props.defaultFallbackRules.length ? props.defaultFallbackRules : [{ ...DEFAULT_NOTIFICATION_RULE }]
      localRules.value = fallback.map((r) => ({
        uid: uidCounter++,
        daysBefore: r.daysBefore,
        time: r.time,
        isCustom: !isPreset(r.daysBefore),
      }))
    }
  }
  emitUpdate()
}

function onPresetChange(rule: EditableRule, event: Event) {
  const target = event.target as HTMLSelectElement
  const val = target.value
  if (val === 'custom') {
    rule.isCustom = true
    if (isPreset(rule.daysBefore)) {
      rule.daysBefore = 4
    }
  } else {
    rule.isCustom = false
    rule.daysBefore = Number(val)
  }
  emitUpdate()
}

function onDaysChange(rule: EditableRule, event: Event) {
  const target = event.target as HTMLInputElement
  const raw = target.value.trim()
  if (raw === '') return
  const val = Math.max(0, Math.min(MAX_DAYS_BEFORE, Math.floor(Number(raw))))
  if (Number.isFinite(val)) {
    rule.daysBefore = val
    emitUpdate()
  }
}

function onTimeChange(rule: EditableRule, event: Event) {
  const target = event.target as HTMLInputElement
  const val = target.value
  if (isValidTime(val)) {
    rule.time = val
    emitUpdate()
  }
}

function addRule() {
  if (localRules.value.length >= MAX_NOTIFICATION_RULES) return
  const next = nextCandidateRule(localRules.value.map((r) => ({ daysBefore: r.daysBefore, time: r.time })))
  localRules.value.push({
    uid: uidCounter++,
    daysBefore: next.daysBefore,
    time: next.time,
    isCustom: !isPreset(next.daysBefore),
  })
  emitUpdate()
}

function removeRule(index: number) {
  localRules.value.splice(index, 1)
  emitUpdate()
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="showToggle" class="flex items-center justify-between">
      <label class="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-2">
        <input
          type="checkbox"
          class="h-4 w-4 rounded accent-accent-icon"
          :checked="isEnabled"
          :disabled="disabled"
          @change="toggleEnabled(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ toggleLabel || t('notifications.title') }}</span>
      </label>
    </div>

    <div v-if="!showToggle || isEnabled" class="space-y-2">
      <div v-if="localRules.length === 0" class="text-xs italic text-ink-5">
        {{ t('notifications.none') }}
      </div>

      <div
        v-for="(rule, index) in localRules"
        :key="rule.uid"
        class="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 p-2 text-xs"
      >
        <!-- Preavviso -->
        <div class="flex flex-1 min-w-[140px] items-center gap-1.5">
          <select
            :value="rule.isCustom ? 'custom' : rule.daysBefore"
            :disabled="disabled"
            class="field h-9 flex-1 px-2 py-1 text-xs"
            :aria-label="t('notifications.title')"
            @change="onPresetChange(rule, $event)"
          >
            <option v-for="opt in PRESET_OPTIONS" :key="opt.value" :value="opt.value">
              {{ t(opt.labelKey) }}
            </option>
          </select>
          <div v-if="rule.isCustom" class="flex items-center gap-1">
            <input
              type="number"
              min="0"
              :max="MAX_DAYS_BEFORE"
              :value="rule.daysBefore"
              :disabled="disabled"
              class="field h-9 w-14 px-1 py-1 text-center text-xs"
              :aria-label="t('notifications.daysBeforeInput')"
              @input="onDaysChange(rule, $event)"
            />
            <span class="whitespace-nowrap text-ink-4">{{ t('notifications.daysBeforeInput') }}</span>
          </div>
        </div>

        <!-- Orario -->
        <div class="flex items-center gap-1.5">
          <span class="text-ink-4">{{ t('notifications.atTime') }}</span>
          <input
            type="time"
            :value="rule.time"
            :disabled="disabled"
            required
            class="field h-9 w-24 px-2 py-1 text-center text-xs"
            :aria-label="t('notifications.atTime')"
            @change="onTimeChange(rule, $event)"
          />
        </div>

        <!-- Elimina -->
        <button
          type="button"
          :disabled="disabled"
          class="rounded p-1.5 text-ink-5 hover:text-negative disabled:opacity-50"
          :aria-label="t('notifications.removeRule')"
          @click="removeRule(index)"
        >
          <i class="fa-solid fa-trash text-sm"></i>
        </button>
      </div>

      <div v-if="localRules.length < MAX_NOTIFICATION_RULES" class="pt-1">
        <button
          type="button"
          :disabled="disabled"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-strong disabled:opacity-50"
          @click="addRule"
        >
          <i class="fa-solid fa-plus text-[10px]"></i>
          {{ t('notifications.addRule') }}
        </button>
      </div>
    </div>
  </div>
</template>
