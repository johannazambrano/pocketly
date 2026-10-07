<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <button type="submit" class="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow transition hover:bg-emerald-500">
    {{ label }}
  </button>
</template>
