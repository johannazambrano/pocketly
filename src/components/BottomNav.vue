<script setup lang="ts">
/**
 * Navigazione principale:
 * - Telefono / finestre strette (< 768 px): dock flottante contestuale alla piattaforma (iOS Liquid Glass con orb "+"
 *   affiancato, Android Material 3 Expressive con FAB coordinato e Modal Bottom Sheet per "Altro", PC floating dock
 *   centrato con "+" integrato). Include scorciatoia Cerca, azione "+" contestuale alla pagina e indicatori di stato.
 * - Tablet e PC (>= 768 px): barra laterale fissa con tutte le voci.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { TABS } from '@/router'
import { useAppearanceStore } from '@/stores/appearance'
import { useBackupStore } from '@/stores/backup'
import { useSyncStore } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'
import { updateReady, reloadPending } from '@/composables/useAppUpdate'
import { resolveSettingsAlert, type NavAlertTone } from '@/utils/navStatus'

const MAIN_COUNT = 4
const mainTabs = TABS.slice(0, MAIN_COUNT)
const moreTabs = TABS.slice(MAIN_COUNT)

const { t } = useI18n()
const route = useRoute()
const appearance = useAppearanceStore()
const backup = useBackupStore()
const sync = useSyncStore()
const ui = useUiStore()

const platform = computed(() => appearance.platform)
const isIos = computed(() => platform.value === 'ios')
const isAndroid = computed(() => platform.value === 'android')
const isDesktop = computed(() => platform.value === 'desktop')

const moreOpen = ref(false)
const moreBtn = ref<HTMLButtonElement | null>(null)
const morePanel = ref<HTMLElement | null>(null)
const moreSearchBtn = ref<HTMLButtonElement | null>(null)
let restoreFocusOnClose = true

/** Le pagine di approfondimento (es. il dettaglio di una categoria) tengono evidenziata la voce da cui si arriva. */
const isParent = (name: string) => route.meta.navParent === name
const isActive = (name: string) => route.name === name || isParent(name)

const activeMoreTab = computed(() => moreTabs.find((tab) => isActive(tab.name)) ?? null)
const moreActive = computed(() => activeMoreTab.value !== null)
const moreAriaLabel = computed(() =>
  activeMoreTab.value ? t('nav.moreActive', { section: t(`nav.${activeMoreTab.value.name}`) }) : t('nav.more'),
)

const addLabel = computed(() => ui.pageAction?.label ?? t('onetime.new'))

const settingsAlert = computed(() =>
  resolveSettingsAlert({
    syncEnabled: sync.enabled,
    syncStatus: sync.status,
    updateReady: updateReady.value,
    reloadPending: reloadPending.value,
    backupReminderDue: backup.reminderDue,
  }),
)

const ALERT_DOT_CLASS: Record<NavAlertTone, string> = {
  negative: 'bg-negative-fill',
  accent: 'bg-accent-fill',
  caution: 'bg-caution-fill',
}

const ALERT_PILL_CLASS: Record<NavAlertTone, string> = {
  negative: 'bg-negative-soft-2 text-negative',
  accent: 'bg-accent-soft text-accent',
  caution: 'bg-caution-soft-2 text-caution',
}

const showMoreAlertDot = computed(() => !!settingsAlert.value && !isActive('settings'))

function openMore() {
  restoreFocusOnClose = true
  moreOpen.value = true
}

function closeMore(restoreFocus = true) {
  restoreFocusOnClose = restoreFocus
  moreOpen.value = false
}

function toggleMore() {
  if (moreOpen.value) closeMore(true)
  else openMore()
}

function openSearchFromMore() {
  closeMore(false)
  ui.openSearch()
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeMore(true)
    return
  }
  if (e.key !== 'Tab' || !morePanel.value) return
  const items = [...morePanel.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  if (e.shiftKey && (active === first || !morePanel.value.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !morePanel.value.contains(active))) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => route.fullPath,
  () => closeMore(false),
)

watch(
  () => ui.searchOpen,
  (open) => {
    if (open && moreOpen.value) closeMore(false)
  },
)

watch(moreOpen, async (open) => {
  if (open) {
    document.addEventListener('keydown', onKey)
    await nextTick()
    moreSearchBtn.value?.focus()
  } else {
    document.removeEventListener('keydown', onKey)
    if (restoreFocusOnClose) {
      await nextTick()
      moreBtn.value?.focus()
    }
  }
})

onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

const dockRowClass = computed(() => {
  switch (platform.value) {
    case 'ios':
      return 'mx-auto mb-2.5 flex max-w-xl items-center gap-2 px-3'
    case 'android':
      return 'mx-auto mb-2.5 flex max-w-xl items-center px-3'
    default:
      return 'mx-auto mb-3 flex max-w-lg items-center px-3'
  }
})

const capsuleClass = computed(() => {
  switch (platform.value) {
    case 'ios':
      return 'pointer-events-auto flex min-w-0 flex-1 items-center rounded-[28px] border border-dock-border bg-dock p-1 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl backdrop-saturate-150'
    case 'android':
      return 'pointer-events-auto flex min-w-0 flex-1 items-center rounded-[28px] border border-dock-border bg-dock px-2 py-1.5 shadow-md'
    default:
      return 'pointer-events-auto flex min-w-0 flex-1 items-center gap-0.5 rounded-2xl border border-dock-border bg-dock p-1.5 shadow-lg backdrop-blur-xl'
  }
})

function tabItemClass(active: boolean) {
  const base =
    'group relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[10.5px] leading-tight tracking-tight transition-all duration-150 active:scale-95'
  if (isAndroid.value) {
    return [base, '!text-xs !tracking-normal', active ? 'font-semibold text-ink' : 'text-ink-4']
  }
  if (isIos.value) {
    return [base, 'rounded-[22px]', active ? 'bg-dock-pill font-semibold text-accent' : 'text-ink-4 hover:text-ink-2']
  }
  return [base, 'rounded-xl', active ? 'bg-dock-pill font-semibold text-accent' : 'text-ink-4 hover:bg-surface-2 hover:text-ink-2']
}

function iconWrapClass(active: boolean) {
  if (isAndroid.value) {
    return [
      'flex h-8 w-12 min-[380px]:w-14 items-center justify-center rounded-full transition-colors duration-200',
      active ? 'bg-dock-pill text-ink' : 'group-hover:bg-surface-4/50',
    ]
  }
  return ['relative inline-flex items-center justify-center transition-transform duration-150', isIos.value && active ? 'scale-105' : '']
}

const addButtonClass = computed(() => {
  if (isAndroid.value) {
    return [
      'pointer-events-auto fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent-soft-2 text-accent-strongest shadow-lg transition-all duration-150 hover:brightness-95 active:scale-95 md:hidden',
      moreOpen.value ? 'pointer-events-none scale-90 opacity-0' : '',
    ]
  }
  if (isIos.value) {
    return 'pointer-events-auto inline-flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full border border-dock-border bg-accent-fill text-on-color shadow-lg transition-transform duration-150 active:scale-95 max-[374px]:fixed max-[374px]:right-3 max-[374px]:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] max-[374px]:h-12 max-[374px]:w-12'
  }
  return 'pointer-events-auto inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-accent-fill text-on-color shadow-sm transition-all duration-150 hover:bg-accent-fill-strong active:scale-95 max-[379px]:fixed max-[379px]:right-3 max-[379px]:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] max-[379px]:h-12 max-[379px]:w-12'
})

const scrimClass = computed(() =>
  isAndroid.value ? 'fixed inset-0 z-40 bg-black/40 md:hidden' : 'fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] md:hidden',
)

const panelClass = computed(() => {
  switch (platform.value) {
    case 'ios':
      return 'fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl rounded-3xl border border-dock-border bg-dock-sheet p-2.5 shadow-2xl backdrop-blur-2xl backdrop-saturate-150 md:hidden'
    case 'android':
      return 'fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl rounded-t-[28px] bg-dock-sheet px-4 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl md:hidden'
    default:
      return 'fixed right-[max(0.75rem,calc(50%-16rem))] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 w-[min(17.5rem,calc(100vw-1.5rem))] rounded-2xl border border-dock-border bg-dock-sheet p-2 shadow-2xl backdrop-blur-xl md:hidden'
  }
})

const searchRowClass = computed(() => {
  if (isAndroid.value) {
    return 'mb-2.5 flex min-h-12 w-full items-center gap-3 rounded-full bg-surface-3 px-4 text-left text-sm text-ink-3 transition hover:bg-surface-4'
  }
  if (isIos.value) {
    return 'mb-2 flex min-h-11 w-full items-center gap-2.5 rounded-2xl bg-surface-2 px-3.5 text-left text-sm text-ink-3 transition hover:bg-surface-3'
  }
  return 'mb-2 flex min-h-10 w-full items-center gap-2.5 rounded-xl bg-surface-2 px-3 text-left text-sm text-ink-3 transition hover:bg-surface-3'
})

function moreRowClass(active: boolean) {
  if (isAndroid.value) {
    return [
      'flex min-h-12 items-center gap-3 rounded-full px-4 text-sm transition-colors',
      active ? 'bg-dock-pill font-semibold text-ink' : 'font-medium text-ink-2 hover:bg-surface-3',
    ]
  }
  if (isIos.value) {
    return [
      'flex min-h-12 items-center gap-3 px-3.5 text-sm transition-colors',
      active ? 'bg-dock-pill font-semibold text-accent' : 'font-medium text-ink-2 hover:bg-surface-2',
    ]
  }
  return [
    'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
    active ? 'bg-dock-pill font-semibold text-accent' : 'font-medium text-ink-2 hover:bg-surface-2',
  ]
}
</script>

<template>
  <nav :aria-label="t('nav.menu')" class="md:sticky md:top-[calc(5rem+env(safe-area-inset-top))] md:order-first md:w-52 md:shrink-0 md:self-start">
    <!-- Scrim modale per il menu "Altro" su mobile -->
    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-150" leave-active-class="transition duration-150">
      <div v-if="moreOpen" :class="scrimClass" @click="closeMore(true)"></div>
    </Transition>

    <!-- Pannello / Bottom Sheet "Altro" per piattaforma -->
    <Transition
      enter-from-class="opacity-0 translate-y-3"
      leave-to-class="opacity-0 translate-y-3"
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-150 ease-in"
    >
      <div v-if="moreOpen" ref="morePanel" role="dialog" aria-modal="true" :aria-label="t('nav.more')" :class="panelClass">
        <div v-if="isAndroid" class="mb-2.5 flex justify-center" aria-hidden="true">
          <span class="h-1 w-8 rounded-full bg-ink-6/70"></span>
        </div>

        <p v-if="isAndroid" class="mb-2 px-1 text-xs font-medium text-ink-4">{{ t('nav.moreSections') }}</p>

        <button ref="moreSearchBtn" type="button" :class="searchRowClass" @click="openSearchFromMore">
          <i class="fa-solid fa-magnifying-glass shrink-0 text-ink-4" aria-hidden="true"></i>
          <span class="min-w-0 flex-1 truncate">{{ t('nav.searchHint') }}</span>
          <kbd
            v-if="isDesktop"
            class="hidden shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-4 sm:inline-flex"
          >
            Ctrl K
          </kbd>
        </button>

        <div :class="isIos ? 'divide-y divide-line-soft overflow-hidden rounded-2xl bg-surface' : 'flex flex-col gap-0.5'">
          <RouterLink v-for="tab in moreTabs" :key="tab.name" :to="tab.path" :class="moreRowClass(isActive(tab.name))">
            <i class="fa-solid w-5 shrink-0 text-center" :class="tab.icon" aria-hidden="true"></i>
            <span class="min-w-0 flex-1 truncate">{{ t(`nav.${tab.name}`) }}</span>
            <span
              v-if="tab.name === 'settings' && settingsAlert"
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="ALERT_PILL_CLASS[settingsAlert.tone]"
            >
              {{ t(`nav.alerts.${settingsAlert.kind}`) }}
            </span>
            <i v-else-if="isIos && isActive(tab.name)" class="fa-solid fa-check shrink-0 text-xs text-accent" aria-hidden="true"></i>
          </RouterLink>
        </div>
      </div>
    </Transition>

    <!-- Telefono / finestre strette (< md): dock flottante + azione "+" contestuale -->
    <div class="pb-safe px-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div :class="dockRowClass">
        <div :class="capsuleClass">
          <RouterLink v-for="tab in mainTabs" :key="tab.name" :to="tab.path" :class="tabItemClass(isActive(tab.name))">
            <span :class="iconWrapClass(isActive(tab.name))">
              <i class="fa-solid text-lg" :class="tab.icon" aria-hidden="true"></i>
            </span>
            <span class="w-full truncate text-center">{{ t(`nav.${tab.name}`) }}</span>
          </RouterLink>

          <button
            ref="moreBtn"
            type="button"
            :class="tabItemClass(moreActive || moreOpen)"
            :aria-label="moreAriaLabel"
            aria-haspopup="dialog"
            :aria-expanded="moreOpen"
            @click="toggleMore"
          >
            <span :class="iconWrapClass(moreActive || moreOpen)">
              <span class="relative inline-flex items-center justify-center">
                <i class="fa-solid fa-ellipsis text-lg" aria-hidden="true"></i>
                <span
                  v-if="showMoreAlertDot"
                  class="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full ring-2 ring-dock"
                  :class="ALERT_DOT_CLASS[settingsAlert!.tone]"
                  aria-hidden="true"
                ></span>
              </span>
            </span>
            <span class="w-full truncate text-center">{{ t('nav.more') }}</span>
          </button>

          <template v-if="isDesktop">
            <span class="mx-0.5 hidden h-7 w-px shrink-0 bg-line min-[380px]:block" aria-hidden="true"></span>
            <button type="button" :class="addButtonClass" :aria-label="addLabel" :title="addLabel" @click="ui.triggerPrimaryAdd()">
              <i class="fa-solid fa-plus text-lg" aria-hidden="true"></i>
            </button>
          </template>
        </div>

        <button v-if="!isDesktop" type="button" :class="addButtonClass" :aria-label="addLabel" :title="addLabel" @click="ui.triggerPrimaryAdd()">
          <i class="fa-solid fa-plus text-xl" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Tablet e PC (>= md): menu laterale -->
    <div class="hidden max-h-[calc(100dvh-6rem-env(safe-area-inset-top))] overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-sm md:block">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="tab.path"
        class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-3 transition hover:bg-surface-3 [@media(max-height:520px)]:min-h-9"
        :class="{ '!bg-accent-soft !text-accent': isParent(tab.name) }"
        exact-active-class="!bg-accent-soft !text-accent"
      >
        <i class="fa-solid w-5 text-center" :class="tab.icon" aria-hidden="true"></i>
        <span class="min-w-0 flex-1 truncate">{{ t(`nav.${tab.name}`) }}</span>
        <span
          v-if="tab.name === 'settings' && settingsAlert"
          class="h-2 w-2 shrink-0 rounded-full"
          :class="ALERT_DOT_CLASS[settingsAlert.tone]"
          :title="t(`nav.alerts.${settingsAlert.kind}`)"
          :aria-label="t(`nav.alerts.${settingsAlert.kind}`)"
        ></span>
      </RouterLink>
    </div>
  </nav>
</template>
