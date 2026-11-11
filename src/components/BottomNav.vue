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
import { useAppearanceStore } from '@/stores/appearance'
import { useUiStore } from '@/stores/ui'

const MAIN_COUNT = 4
const mainTabs = TABS.slice(0, MAIN_COUNT)
const moreTabs = TABS.slice(MAIN_COUNT)

const { t } = useI18n()
const route = useRoute()
const appearance = useAppearanceStore()
const ui = useUiStore()
const android = computed(() => appearance.platform === 'android')

const moreOpen = ref(false)
const moreActive = computed(() => moreTabs.some((tab) => tab.name === route.name))
/** Le pagine di approfondimento (es. il dettaglio di una categoria) tengono evidenziata la voce da cui si arriva. */
const isParent = (name: string) => route.meta.navParent === name

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

/**
 * Cinque voci su 320px lasciano circa 64px ciascuna: margine minimo e lettere un po' più strette perché anche
 * "Dashboard" in grassetto (voce attiva) stia per intero.
 */
const barItem =
  'group flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] tracking-tight text-ink-4 transition hover:text-accent-icon'
/**
 * La barra in basso per piattaforma: su iPhone traslucida con il colore della tinta sulla voce attiva; su Android la
 * "navigation bar" di Material, con la pillola dietro l'icona attiva ed etichette di 12px; altrove la barra di sempre.
 */
const barShell = computed(() => {
  switch (appearance.platform) {
    case 'ios':
      return 'border-t border-line bg-surface/85 backdrop-blur-xl'
    case 'android':
      return 'bg-surface-3'
    default:
      return 'border-t border-line bg-surface shadow-lg'
  }
})
/** Su Android l'icona sta in una pillola: piena (secondary container) sulla voce attiva. */
const pill = (active: boolean) =>
  android.value
    ? ['flex h-8 w-14 items-center justify-center rounded-full transition', active ? 'bg-accent-soft text-ink' : '']
    : []
const isActive = (name: string) => route.name === name || isParent(name)
</script>

<template>
  <nav :aria-label="t('nav.menu')" class="md:sticky md:top-[calc(5rem+env(safe-area-inset-top))] md:order-first md:w-52 md:shrink-0 md:self-start">
    <!-- Telefono: barra in basso -->
    <div v-if="moreOpen" class="fixed inset-0 z-30 md:hidden" @click="moreOpen = false"></div>
    <!--
      Android: il "+" è il pulsante flottante in basso a destra, dove arriva il pollice (Material: una sola azione
      principale per schermata). Su schermi larghi torna nell'intestazione.
    -->
    <button
      v-if="android"
      type="button"
      class="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft-2 text-accent-strongest shadow-lg transition hover:brightness-95 md:hidden"
      :aria-label="t('onetime.new')"
      @click="ui.quickAddOpen = true"
    >
      <i class="fa-solid fa-plus text-xl" aria-hidden="true"></i>
    </button>
    <div class="pb-safe px-safe fixed inset-x-0 bottom-0 z-40 md:hidden" :class="barShell">
      <div class="mx-auto flex max-w-xl" :class="{ 'py-1.5': android }">
        <RouterLink
          v-for="tab in mainTabs"
          :key="tab.name"
          :to="tab.path"
          :class="[barItem, isActive(tab.name) ? (android ? '!text-ink font-semibold' : '!text-accent font-bold') : '', android ? '!text-xs' : '']"
        >
          <span :class="pill(isActive(tab.name))"><i class="fa-solid text-lg" :class="tab.icon" aria-hidden="true"></i></span>
          <span class="w-full truncate text-center">{{ t(`nav.${tab.name}`) }}</span>
        </RouterLink>

        <div class="relative flex min-w-0 flex-1">
          <button
            type="button"
            class="w-full"
            :class="[barItem, moreActive || moreOpen ? (android ? '!text-ink font-semibold' : '!text-accent font-bold') : '', android ? '!text-xs' : '']"
            aria-haspopup="true"
            :aria-expanded="moreOpen"
            @click="moreOpen = !moreOpen"
          >
            <span :class="pill(moreActive || moreOpen)"><i class="fa-solid fa-ellipsis text-lg" aria-hidden="true"></i></span>
            <span class="w-full truncate text-center">{{ t('nav.more') }}</span>
          </button>
          <div v-if="moreOpen" class="absolute right-1 bottom-full mb-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
            <RouterLink
              v-for="tab in moreTabs"
              :key="tab.name"
              :to="tab.path"
              class="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface-3"
              exact-active-class="!bg-accent-soft !text-accent"
            >
              <i class="fa-solid w-5 text-center" :class="tab.icon"></i>
              {{ t(`nav.${tab.name}`) }}
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Tablet e PC: menu laterale -->
    <div class="hidden max-h-[calc(100dvh-6rem-env(safe-area-inset-top))] overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-sm md:block">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="tab.path"
        class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-3 transition hover:bg-surface-3 [@media(max-height:520px)]:min-h-9"
        :class="{ '!bg-accent-soft !text-accent': isParent(tab.name) }"
        exact-active-class="!bg-accent-soft !text-accent"
      >
        <i class="fa-solid w-5 text-center" :class="tab.icon"></i>
        <span class="truncate">{{ t(`nav.${tab.name}`) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
