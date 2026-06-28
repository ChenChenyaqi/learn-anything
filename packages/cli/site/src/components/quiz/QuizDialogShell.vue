<script setup lang="ts">
/* Shared dialog container: role/aria attributes, shared sizing/border
 * styling, an optional floating close button, and a slot for content.
 *
 * `layoutClass` supplies the grid template (e.g. 'grid grid-rows-[auto_1fr_auto]'
 * or 'flex flex-col min-h-50 items-center justify-center') — passed as a
 * literal string so Tailwind can detect it.
 *
 * The dialog element is exposed so the parent can focus it and run its
 * keyboard `contains()` checks. */
import { ref } from 'vue';
import QuizCloseButton from './QuizCloseButton.vue';

defineProps<{
  layoutClass?: string;
  closeable?: boolean;
}>();

defineEmits<{
  close: [];
}>();

const dialogEl = ref<HTMLElement | null>(null);

defineExpose({ dialogEl });
</script>

<template>
  <div
    ref="dialogEl"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    :class="[
      'relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl border border-(--color-divider) bg-(--color-bg-elv) shadow-2xl outline-none',
      layoutClass,
    ]"
  >
    <QuizCloseButton v-if="closeable" floating @close="$emit('close')" />
    <slot />
  </div>
</template>
