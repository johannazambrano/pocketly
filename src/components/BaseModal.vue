<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) document.addEventListener('keydown', onKey)
    else document.removeEventListener('keydown', onKey)
    document.body.style.overflow = open ? 'hidden' : ''
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition duration-150"
      leave-active-class="transition duration-150"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <div
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          class="pb-safe max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-xl"
        >
          <div class="p-5">
            <div class="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 class="text-base font-bold text-slate-800">{{ title }}</h3>
              <button type="button" class="icon-btn text-slate-400" :aria-label="t('common.close')" @click="emit('close')">
                <i class="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
