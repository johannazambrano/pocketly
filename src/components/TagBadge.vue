<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { readableTextColor } from '@/utils/colors'

const props = withDefaults(
  defineProps<{
    kind: TagKind
    id: string
    clickable?: boolean
  }>(),
  {
    clickable: false,
  },
)

const finance = useFinanceStore()
const { t } = useI18n()
const tag = computed(() => finance.tag(props.kind, props.id))
const background = computed(() => tag.value?.color ?? '#94a3b8')
</script>

<template>
  <span
    class="inline-flex max-w-[9rem] items-center gap-0.5 truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-all"
    :class="{
      'cursor-pointer hover:opacity-85 active:scale-95': clickable,
      'rounded-full px-2 shadow-2xs': kind === 'tags',
    }"
    :style="{ backgroundColor: background, color: readableTextColor(background) }"
  >
    <span v-if="kind === 'tags'" class="font-semibold opacity-75">#</span>
    <span class="truncate">{{ tag?.name ?? t('common.unknown') }}</span>
  </span>
</template>
