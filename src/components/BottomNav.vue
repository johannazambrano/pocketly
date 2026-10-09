<script setup lang="ts">
/**
 * Navigazione principale. Sul telefono è una barra in basso con le schede più usate e un menu "Altro"
 * (sette schede in 320 px non starebbero, né con etichette leggibili né con bersagli di tocco adeguati).
 * Da tablet in su diventa un menu laterale con tutte le voci.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { TABS } from '@/router'

const MAIN_COUNT = 4
const mainTabs = TABS.slice(0, MAIN_COUNT)
const moreTabs = TABS.slice(MAIN_COUNT)

const { t } = useI18n()
const route = useRoute()

const moreOpen = ref(false)
const moreActive = computed(() => moreTabs.some((tab) => tab.name === route.name))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') moreOpen.value = false
}

watch(
  () => route.fullPath,
  () => (moreOpen.value = false),
)
watch(moreOpen, (open) => {
  if (open) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

const barItem =
  'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] text-slate-500 transition hover:text-emerald-600'
</script>

<template>
  <nav :aria-label="t('nav.menu')" class="md:sticky md:top-[calc(5rem+env(safe-area-inset-top))] md:order-first md:w-52 md:shrink-0 md:self-start">
    <!-- Telefono: barra in basso -->
    <div v-if="moreOpen" class="fixed inset-0 z-30 md:hidden" @click="moreOpen = false"></div>
    <div class="pb-safe px-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-lg md:hidden">
      <div class="mx-auto flex max-w-xl">
        <RouterLink v-for="tab in mainTabs" :key="tab.name" :to="tab.path" :class="barItem" exact-active-class="!text-emerald-600 font-bold">
          <i class="fa-solid text-lg" :class="tab.icon"></i>
          <span class="w-full truncate text-center">{{ t(`nav.${tab.name}`) }}</span>
        </RouterLink>

        <div class="relative flex min-w-0 flex-1">
          <button
            type="button"
            class="w-full"
            :class="[barItem, moreActive || moreOpen ? '!text-emerald-600 font-bold' : '']"
            aria-haspopup="true"
            :aria-expanded="moreOpen"
            @click="moreOpen = !moreOpen"
          >
            <i class="fa-solid fa-ellipsis text-lg"></i>
            <span class="w-full truncate text-center">{{ t('nav.more') }}</span>
          </button>
          <div v-if="moreOpen" class="absolute right-1 bottom-full mb-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <RouterLink
              v-for="tab in moreTabs"
              :key="tab.name"
              :to="tab.path"
              class="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              exact-active-class="!bg-emerald-50 !text-emerald-700"
            >
              <i class="fa-solid w-5 text-center" :class="tab.icon"></i>
              {{ t(`nav.${tab.name}`) }}
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Tablet e PC: menu laterale -->
    <div class="hidden max-h-[calc(100dvh-6rem-env(safe-area-inset-top))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm md:block">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="tab.path"
        class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 [@media(max-height:520px)]:min-h-9"
        exact-active-class="!bg-emerald-50 !text-emerald-700"
      >
        <i class="fa-solid w-5 text-center" :class="tab.icon"></i>
        <span class="truncate">{{ t(`nav.${tab.name}`) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
