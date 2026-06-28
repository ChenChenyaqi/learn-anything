<script setup lang="ts">
/* Quiz modal top bar: back link + progress text + help popover + close.
 * Renders group progress (queue mode) or single-deck question progress. */
import { useI18n } from '@/composables/useI18n';
import QuizHelpPopover from './QuizHelpPopover.vue';
import QuizCloseButton from '@/components/quiz/QuizCloseButton.vue';

defineProps<{
  progressText: string;
  groupProgressText?: string;
  currentGroupLabel?: string;
}>();

defineEmits<{
  close: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex items-center justify-between border-b border-(--color-divider) px-6 py-3">
    <button
      class="cursor-pointer text-xs text-text-3 transition-colors hover:text-brand-2"
      @click="$emit('close')"
    >
      ← {{ t('quiz.backToList') }}
    </button>
    <div class="flex items-center gap-3">
      <span v-if="groupProgressText" class="text-xs text-text-3">
        {{ groupProgressText
        }}<span v-if="currentGroupLabel" class="ml-1 text-text-2">· {{ currentGroupLabel }}</span>
      </span>
      <span v-else class="font-mono text-xs text-text-3">{{ progressText }}</span>
      <QuizHelpPopover />
      <QuizCloseButton @close="$emit('close')" />
    </div>
  </div>
</template>
