<script setup lang="ts">
defineProps<{ resizing: boolean }>();
const emit = defineEmits<{ start: [event: MouseEvent] }>();
</script>

<template>
  <div
    class="relative w-4 h-full shrink-0 cursor-col-resize group"
    style="touch-action: none"
    @mousedown="emit('start', $event)"
  >
    <div
      class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-(--color-rule) transition-colors group-hover:bg-(--color-accent)"
      :class="{ 'bg-(--color-accent)': resizing }"
    />
  </div>
</template>
