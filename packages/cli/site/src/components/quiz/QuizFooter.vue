<script setup lang="ts">
/* Quiz modal bottom bar: previous / next / submit with keyboard hints.
 * The parent decides whether to render it (e.g. hidden on completion). */
import { useI18n } from '@/composables/useI18n';
import { usePlatform } from '@/composables/usePlatform';

defineProps<{
  isFirst: boolean;
  isLast: boolean;
}>();

defineEmits<{
  prev: [];
  next: [];
  submit: [];
}>();

const { t } = useI18n();
const { isMac } = usePlatform();
</script>

<template>
  <div class="flex items-center justify-between border-t border-(--color-divider) px-6 py-3">
    <button
      class="flex cursor-pointer items-center gap-1.5 px-4 py-2 text-sm text-text-2 transition-colors hover:text-text-1 disabled:cursor-not-allowed disabled:opacity-30"
      :disabled="isFirst"
      @click="$emit('prev')"
    >
      <kbd
        class="rounded border border-(--color-divider) px-1.5 py-0.5 font-mono text-xs text-text-3"
        >←</kbd
      >
      {{ t('quiz.previous') }}
    </button>
    <button
      v-if="isLast"
      class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-2 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-1"
      @click="$emit('submit')"
    >
      {{ t('quiz.submit') }}
      <kbd class="rounded border border-white/30 px-1.5 py-0.5 font-mono text-xs text-white/80"
        >{{ isMac ? '⌘' : 'Ctrl' }} ↵</kbd
      >
    </button>
    <button
      v-else
      class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-2 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-1"
      @click="$emit('next')"
    >
      {{ t('quiz.next') }}
      <kbd class="rounded border border-white/30 px-1.5 py-0.5 font-mono text-xs text-white/80"
        >→</kbd
      >
    </button>
  </div>
</template>
