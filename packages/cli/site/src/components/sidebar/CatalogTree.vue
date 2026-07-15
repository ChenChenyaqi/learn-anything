<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import CatalogTreeBranch from './CatalogTreeBranch.vue';
import type { CatalogTreeFile, CatalogTreeNode } from './catalogTree';
import { collectCatalogFiles } from './catalogTree';

const props = defineProps<{
  nodes: CatalogTreeNode[];
  selectedFilePath?: string | null;
  emptyLabel: string;
  quizActions?: boolean;
}>();

const emit = defineEmits<{
  'file-selected': [file: CatalogTreeFile];
  batch: [files: CatalogTreeFile[], mode: 'sequential' | 'random'];
}>();

const { t } = useI18n();
const expandedKeys = ref(new Set<string>());
const allFiles = computed(() => collectCatalogFiles(props.nodes));

function findAncestors(nodes: CatalogTreeNode[], filePath: string, parents: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === 'file' && node.path === filePath) return parents;
    if (node.type === 'directory') {
      const found = findAncestors(node.children, filePath, [...parents, node.key]);
      if (found.length > 0) return found;
    }
  }
  return [];
}

watch(
  () => [props.nodes, props.selectedFilePath] as const,
  () => {
    const next = new Set(expandedKeys.value);
    const firstDirectory = props.nodes.find((node) => node.type === 'directory');
    if (next.size === 0 && firstDirectory?.type === 'directory') next.add(firstDirectory.key);
    if (props.selectedFilePath) {
      for (const key of findAncestors(props.nodes, props.selectedFilePath)) next.add(key);
    }
    expandedKeys.value = next;
  },
  { immediate: true, deep: true },
);

function toggle(key: string) {
  const next = new Set(expandedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedKeys.value = next;
}
</script>

<template>
  <div v-if="nodes.length > 0" class="space-y-px">
    <div v-if="quizActions" class="flex items-center justify-between py-1 mb-1">
      <span class="text-xs font-medium uppercase tracking-wide text-text-3">
        {{ t('quiz.allQuizzes') }}
      </span>
      <span class="flex items-center gap-1">
        <button
          class="text-xs text-text-3 hover:text-brand-2 cursor-pointer"
          :title="t('quiz.sequential')"
          @click="emit('batch', allFiles, 'sequential')"
        >
          {{ t('quiz.sequential') }}
        </button>
        <button
          class="text-xs text-text-3 hover:text-brand-2 cursor-pointer"
          :title="t('quiz.random')"
          @click="emit('batch', allFiles, 'random')"
        >
          {{ t('quiz.random') }}
        </button>
      </span>
    </div>

    <template v-for="node in nodes" :key="node.key">
      <CatalogTreeBranch
        v-if="node.type === 'directory'"
        :node="node"
        :expanded-keys="expandedKeys"
        :orphan-title="t('sidebar.orphanTip')"
        :quiz-actions="quizActions"
        @toggle="toggle"
        @file-selected="emit('file-selected', $event)"
        @batch="(files, mode) => emit('batch', files, mode)"
      />
      <button
        v-else
        class="block w-full text-left py-1 text-xs text-text-2 hover:text-brand-2 transition-colors cursor-pointer truncate font-mono"
        @click="emit('file-selected', node)"
      >
        {{ quizActions ? node.name.replace(/\.json$/, '') : node.name }}
      </button>
    </template>
  </div>
  <div v-else class="py-2 text-xs text-text-3">{{ emptyLabel }}</div>
</template>
