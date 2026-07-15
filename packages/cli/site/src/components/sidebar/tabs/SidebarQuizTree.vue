<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getDataVersion, loadCatalog, loadTopic } from '@/composables/useTopicData';
import type { QueueItem } from '@/components/quiz/types';
import CatalogTree from '@/components/sidebar/CatalogTree.vue';
import {
  buildCatalogTree,
  type CatalogTreeFile,
} from '@/components/sidebar/catalogTree';

const props = defineProps<{ topicSlug: string }>();
const emit = defineEmits<{
  'quiz-selected': [quiz: { path: string }];
  'quiz-batch-selected': [batch: { items: QueueItem[]; mode: 'sequential' | 'random' }];
}>();
const { t } = useI18n();

const state = computed(() => {
  void getDataVersion();
  return loadTopic(props.topicSlug);
});
const nodes = computed(() => {
  void getDataVersion();
  return buildCatalogTree(loadCatalog(props.topicSlug), 'quiz', props.topicSlug, state.value);
});

function restPath(file: CatalogTreeFile): string {
  return file.entry.path.slice('quizzes/'.length);
}

function toQueueItem(file: CatalogTreeFile): QueueItem {
  const fallback = file.entry.path.split('/').slice(-2, -1)[0] ?? 'orphan';
  const conceptSlug = file.entry.conceptSlug ?? fallback;
  const conceptName =
    state.value?.domains
      .flatMap((domain) => domain.concepts)
      .find((concept) => concept.slug === conceptSlug)?.name ?? conceptSlug;
  return {
    concept_slug: conceptSlug,
    concept_name: conceptName,
    filename: file.name,
    path: restPath(file),
  };
}

function selectFile(file: CatalogTreeFile) {
  emit('quiz-selected', { path: restPath(file) });
}

function selectBatch(files: CatalogTreeFile[], mode: 'sequential' | 'random') {
  emit('quiz-batch-selected', { items: files.map(toQueueItem), mode });
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <CatalogTree
      :nodes="nodes"
      :empty-label="t('quiz.empty')"
      quiz-actions
      @file-selected="selectFile"
      @batch="selectBatch"
    />
  </nav>
</template>
