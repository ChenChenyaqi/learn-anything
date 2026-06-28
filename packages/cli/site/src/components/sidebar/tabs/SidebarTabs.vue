<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { SelectedFilePayload } from '@/composables/useTopicData';
import { OmitQuizSourceType } from '@/composables/topicDataTypes';
import type { QueueItem } from '@/components/quiz/types';
import SidebarTopicTree from './SidebarTopicTree.vue';
import SidebarExerciseTree from './SidebarExerciseTree.vue';
import SidebarQuizTree from './SidebarQuizTree.vue';

const props = defineProps<{
  topicSlug?: string;
  selectedFilePath?: string | null;
  initialTab?: OmitQuizSourceType;
}>();

const emit = defineEmits<{
  'file-selected': [file: SelectedFilePayload | null];
  'quiz-selected': [quiz: { path: string }];
  'quiz-batch-selected': [batch: { items: QueueItem[]; mode: 'sequential' | 'random' }];
}>();

const { t } = useI18n();

const tabMode = ref<SelectedFilePayload['sourceTab']>('topics');

watch(
  () => props.initialTab,
  (tab) => {
    if (tab === 'exercises') tabMode.value = tab;
  },
  { immediate: true },
);

function switchTab(tab: 'topics' | 'exercises' | 'quizzes') {
  tabMode.value = tab;
}

function onFileSelected(payload: { path: string; type: 'markdown' | 'code' }) {
  emit('file-selected', {
    ...payload,
    sourceTab: tabMode.value as SelectedFilePayload['sourceTab'],
  });
}

function onKnowledgeMap() {
  emit('file-selected', null);
}

function onQuizSelected(quiz: { path: string }) {
  emit('quiz-selected', quiz);
}

function onQuizBatchSelected(batch: { items: QueueItem[]; mode: 'sequential' | 'random' }) {
  emit('quiz-batch-selected', batch);
}
</script>

<template>
  <div class="px-6 pt-3">
    <div class="flex gap-6">
      <button
        class="pb-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px"
        :class="
          tabMode === 'topics'
            ? 'border-brand-2 text-brand-2'
            : 'border-transparent text-text-2 hover:text-text-1'
        "
        @click="switchTab('topics')"
      >
        {{ t('sidebar.topics') }}
      </button>
      <button
        class="pb-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px"
        :class="
          tabMode === 'exercises'
            ? 'border-brand-2 text-brand-2'
            : 'border-transparent text-text-2 hover:text-text-1'
        "
        @click="switchTab('exercises')"
      >
        {{ t('sidebar.exercises') }}
      </button>
      <button
        class="pb-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px"
        :class="
          tabMode === 'quizzes'
            ? 'border-brand-2 text-brand-2'
            : 'border-transparent text-text-2 hover:text-text-1'
        "
        @click="switchTab('quizzes')"
      >
        {{ t('sidebar.quizzes') }}
      </button>
    </div>
  </div>

  <div class="mx-6 border-t border-(--color-divider)" />

  <SidebarTopicTree
    v-if="tabMode === 'topics' && topicSlug"
    :topic-slug="topicSlug"
    :selected-file-path="selectedFilePath"
    @file-selected="onFileSelected"
    @knowledge-map="onKnowledgeMap"
  />

  <SidebarExerciseTree
    v-if="tabMode === 'exercises' && topicSlug"
    :topic-slug="topicSlug"
    :selected-file-path="selectedFilePath"
    @file-selected="onFileSelected"
  />

  <SidebarQuizTree
    v-if="tabMode === 'quizzes' && topicSlug"
    :topic-slug="topicSlug"
    @quiz-selected="onQuizSelected"
    @quiz-batch-selected="onQuizBatchSelected"
  />
</template>
