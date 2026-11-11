<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFinanceStore, type TagKind } from '@/stores/finance'
import { badgeColors, OTHER_COLOR } from '@/utils/colors'

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
/** Fondo e testo sempre leggibili, anche per un colore scelto a mano (vedi `badgeColors`). */
const colors = computed(() => badgeColors(tag.value?.color ?? OTHER_COLOR))
</script>

<template>
  <!-- Cliccabile (filtra la lista) diventa un vero pulsante: si raggiunge con la tastiera e, nelle righe che sul telefono
       si aprono al tocco, resta toccabile da solo (vedi `EntryRow`). -->
  <component
    :is="clickable ? 'button' : 'span'"
    :type="clickable ? 'button' : undefined"
    class="inline-flex max-w-[9rem] items-center gap-0.5 truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-all"
    :class="{
      'cursor-pointer hover:opacity-85 active:scale-95': clickable,
      'rounded-full px-2 shadow-2xs': kind === 'tags',
    }"
    :style="{ backgroundColor: colors.background, color: colors.color }"
  >
    <span v-if="kind === 'tags'" class="font-semibold opacity-75">#</span>
    <span class="truncate">{{ tag?.name ?? t('common.unknown') }}</span>
  </component>
</template>
