<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

defineProps<{
  mode: 'queue' | 'single';
  isLastGroup?: boolean;
}>();

defineEmits<{
  retry: [];
  nextGroup: [];
  close: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex items-center justify-between border-t border-(--color-divider) px-6 py-3">
    <template v-if="mode === 'queue'">
      <button
        class="cursor-pointer px-4 py-2 text-sm text-text-2 transition-colors hover:text-brand-2"
        @click="$emit('retry')"
      >
        {{ t('quiz.retryGroup') }}
      </button>
      <button
        v-if="!isLastGroup"
        class="cursor-pointer rounded-lg bg-brand-2 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-1"
        @click="$emit('nextGroup')"
      >
        {{ t('quiz.nextGroup') }} →
      </button>
      <button
        v-else
        class="cursor-pointer rounded-lg bg-brand-2 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-1"
        @click="$emit('nextGroup')"
      >
        {{ t('quiz.viewSummary') }} →
      </button>
    </template>
    <template v-else>
      <button
        class="cursor-pointer px-4 py-2 text-sm text-text-2 transition-colors hover:text-brand-2"
        @click="$emit('close')"
      >
        {{ t('quiz.backToList') }}
      </button>
      <button
        class="cursor-pointer rounded-lg bg-brand-2 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-1"
        @click="$emit('retry')"
      >
        {{ t('quiz.retry') }}
      </button>
    </template>
  </div>
</template>
