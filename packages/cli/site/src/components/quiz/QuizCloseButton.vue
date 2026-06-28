<script setup lang="ts">
/* The modal ✕ close button.
 *
 * `floating` — pins to the top-right corner of a shell dialog with a
 *              larger hit area (loading / results / summary).
 * default    — renders inline at a smaller size (used inside QuizHeader). */
defineProps<{
  floating?: boolean;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <button
    :class="[
      'flex items-center justify-center rounded-full text-text-3 transition-colors cursor-pointer hover:bg-(--color-bg-soft) hover:text-text-1',
      floating ? 'absolute top-3 right-3 z-10 h-7 w-7' : 'h-6 w-6',
    ]"
    aria-label="Close"
    @click="$emit('close')"
  >
    ✕
  </button>
</template>
