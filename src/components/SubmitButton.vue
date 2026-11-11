<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <button type="submit" class="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow transition hover:bg-emerald-800 active:bg-emerald-900">
    {{ label }}
  </button>
</template>
