<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAutoExpand } from './useAutoExpand';
import { loadTopicFiles, getDataVersion } from '@/composables/useTopicData';
import { buildFileTree, collectFiles, type FileLeaf, type DirNode } from '@/components/sidebar/tabs/buildFileTree';
import type { QueueItem } from '@/components/quiz/types';
import QuizIcons from '@/components/quiz/QuizIcons.vue';
import FileTreeBranch from '@/components/sidebar/tabs/FileTreeBranch.vue';


const props = defineProps<{
  topicSlug: string;
}>();

const emit = defineEmits<{
  'quiz-selected': [quiz: { path: string }];
  'quiz-batch-selected': [batch: { items: QueueItem[]; mode: 'sequential' | 'random' }];
}>();

const { t } = useI18n();

const nodes = computed(() => {
  void getDataVersion();
  return buildFileTree(loadTopicFiles(props.topicSlug)?.quizzes ?? []);
});

const allFiles = computed(() => collectFiles(nodes.value));

const firstDirPath = computed(() => {
  const first = nodes.value.find((n) => n.type === 'dir');
  return first?.path;
});

const {
  expanded: expandedKeys,
  toggle: toggleExpansion,
} = useAutoExpand(
  'quizzes',
  () => props.topicSlug,
  () => firstDirPath.value,
);

function onToggle(key: string) {
  toggleExpansion(props.topicSlug, key);
}

function toQueueItem(file: FileLeaf): QueueItem {
  const parts = file.path.split('/');
  return {
    concept_slug: parts.length >= 3 ? parts[parts.length - 2] : parts[0],
    concept_name: parts.length >= 3 ? parts[parts.length - 2] : parts[0],
    filename: file.name,
    path: file.path.slice('quizzes/'.length),
  };
}

function emitBatch(files: FileLeaf[], mode: 'sequential' | 'random') {
  emit('quiz-batch-selected', { items: files.map(toQueueItem), mode });
}

function onFileSelected(file: FileLeaf) {
  emit('quiz-selected', { path: file.path.slice('quizzes/'.length) });
}

function onDirBatch(node: DirNode, mode: 'sequential' | 'random') {
  emitBatch(collectFiles(node.children), mode);
}

function onAllSequential() {
  emitBatch(allFiles.value, 'sequential');
}

function onAllRandom() {
  emitBatch(allFiles.value, 'random');
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <div v-if="nodes.length > 0" class="space-y-px">
      <div class="flex items-center justify-between py-1 mb-1">
        <span class="text-xs font-medium uppercase tracking-wide text-text-3">{{
          t('quiz.allQuizzes')
        }}</span>
        <span class="flex items-center gap-1" @click.stop>
          <button
            class="p-1 rounded text-text-3 hover:text-brand-2 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
            :title="t('quiz.sequential')"
            @click="onAllSequential"
          >
            <QuizIcons icon="sequential" />
          </button>
          <button
            class="p-1 rounded text-text-3 hover:text-brand-2 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
            :title="t('quiz.random')"
            @click="onAllRandom"
          >
            <QuizIcons icon="random" />
          </button>
        </span>
      </div>
      <FileTreeBranch
        :nodes="nodes"
        :expanded-keys="expandedKeys"
        mono
        @toggle="onToggle"
        @file-selected="onFileSelected"
      >
        <template #dir-action="{ node }">
          <span class="ml-auto flex items-center gap-0.5" @click.stop>
            <button
              class="p-0.5 rounded text-text-3 hover:text-brand-2 transition-colors cursor-pointer"
              :title="t('quiz.sequential')"
              @click="onDirBatch(node, 'sequential')"
            >
              <QuizIcons icon="sequential" />
            </button>
            <button
              class="p-0.5 rounded text-text-3 hover:text-brand-2 transition-colors cursor-pointer"
              :title="t('quiz.random')"
              @click="onDirBatch(node, 'random')"
            >
              <QuizIcons icon="random" />
            </button>
          </span>
        </template>
      </FileTreeBranch>
    </div>
    <div v-else class="py-2 text-xs text-text-3">{{ t('quiz.empty') }}</div>
  </nav>
</template>
