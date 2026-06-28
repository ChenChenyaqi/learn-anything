<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import QuizDialogShell from './QuizDialogShell.vue';

defineProps<{
  phase: 'loading' | 'error';
}>();

defineEmits<{
  close: [];
  retry: [];
}>();

const { t } = useI18n();

const shellRef = ref<InstanceType<typeof QuizDialogShell> | null>(null);

defineExpose({
  get dialogEl() {
    return shellRef.value?.dialogEl ?? null;
  },
});
</script>

<template>
  <QuizDialogShell
    ref="shellRef"
    layout-class="flex flex-col min-h-50 items-center justify-center"
    closeable
    @close="$emit('close')"
  >
    <p v-if="phase === 'loading'" class="text-sm text-text-3">...</p>
    <template v-else>
      <p class="text-sm text-text-3 mb-4">{{ t('quiz.loadError') }}</p>
      <button
        class="px-4 py-2 text-sm font-medium text-white bg-brand-2 rounded-lg hover:bg-brand-1 transition-colors cursor-pointer"
        @click="$emit('retry')"
      >
        {{ t('quiz.retry') }}
      </button>
    </template>
  </QuizDialogShell>
</template>
