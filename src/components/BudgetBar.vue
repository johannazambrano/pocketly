<script setup lang="ts">
import { computed } from 'vue'
import type { BudgetStatus } from '@/domain/budget'

const props = defineProps<{ limit: number; spent: number; scheduled: number; status: BudgetStatus; label: string }>()

/** La barra non esce mai dal suo riquadro: oltre il limite resta piena e cambia colore. */
const spentPct = computed(() => Math.min(100, (props.spent / props.limit) * 100))
const scheduledPct = computed(() => Math.min(100 - spentPct.value, (props.scheduled / props.limit) * 100))
const color = computed(() => ({ ok: 'bg-emerald-500', warning: 'bg-amber-500', over: 'bg-rose-500' })[props.status])
</script>

<template>
  <div
    class="flex h-2.5 overflow-hidden rounded-full bg-slate-100"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="Math.round(Math.min(100, ((spent + scheduled) / limit) * 100))"
  >
    <div class="h-full" :class="color" :style="{ width: spentPct + '%' }"></div>
    <!-- Quanto è già in programma (data futura) è più chiaro di ciò che è già stato speso. -->
    <div class="h-full opacity-40" :class="color" :style="{ width: scheduledPct + '%' }"></div>
  </div>
</template>
