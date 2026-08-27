<script setup lang="ts">
// Quiz viewer bottom bar: previous / next / submit with keyboard hints.
// The parent hides it once the session is complete.

import { quizStrings } from './strings';
import { btnPrimary, btnSecondary } from '@/lib/ui';

defineProps<{
  isFirst: boolean;
  isLast: boolean;
}>();

defineEmits<{
  prev: [];
  next: [];
  submit: [];
}>();

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.platform);
</script>

<template>
  <div class="flex items-center justify-between border-t border-(--color-rule) px-6 py-3">
    <button
      type="button"
      :class="[btnSecondary, 'gap-1.5 px-4 py-2 text-sm']"
      :disabled="isFirst"
      @click="$emit('prev')"
    >
      <kbd class="rounded border border-(--color-rule) px-1.5 py-0.5 font-mono text-xs text-text-3"
        >←</kbd
      >
      {{ quizStrings.previous }}
    </button>

    <button
      v-if="isLast"
      type="button"
      :class="[btnPrimary, 'gap-1.5 px-6 py-2 text-sm font-medium']"
      @click="$emit('submit')"
    >
      {{ quizStrings.submit }}
      <kbd class="rounded border border-white/30 px-1.5 py-0.5 font-mono text-xs text-white/80"
        >{{ isMac ? '⌘' : 'Ctrl' }} ↵</kbd
      >
    </button>

    <button
      v-else
      type="button"
      :class="[btnPrimary, 'gap-1.5 px-6 py-2 text-sm font-medium']"
      @click="$emit('next')"
    >
      {{ quizStrings.next }}
      <kbd class="rounded border border-white/30 px-1.5 py-0.5 font-mono text-xs text-white/80"
        >→</kbd
      >
    </button>
  </div>
</template>
