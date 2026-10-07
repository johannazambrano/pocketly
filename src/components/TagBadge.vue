<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { readableTextColor } from '@/utils/colors'

const props = defineProps<{ kind: TagKind; id: string }>()
const finance = useFinanceStore()
const { t } = useI18n()
const tag = computed(() => finance.tag(props.kind, props.id))
const background = computed(() => tag.value?.color ?? '#94a3b8')
</script>

<template>
  <span
    class="inline-block max-w-[9rem] truncate rounded px-1.5 py-0.5 text-[9px] font-medium"
    :style="{ backgroundColor: background, color: readableTextColor(background) }"
  >
    {{ tag?.name ?? t('common.unknown') }}
  </span>
</template>
