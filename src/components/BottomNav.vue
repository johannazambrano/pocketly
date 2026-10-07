<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { TABS } from '@/router'

const { t } = useI18n()
</script>

<template>
  <nav class="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-lg">
    <div class="mx-auto flex max-w-md justify-around py-1.5">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="tab.path"
        class="flex min-w-0 flex-1 flex-col items-center text-[9px] text-slate-400 transition hover:text-emerald-600"
        exact-active-class="!text-emerald-600 font-bold"
      >
        <i class="fa-solid mb-0.5 text-base" :class="tab.icon"></i>
        <span class="truncate">{{ t(`nav.${tab.name}`) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
