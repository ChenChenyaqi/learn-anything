<script setup lang="ts">
import SidebarTreeNode from './SidebarTreeNode.vue';
import QuizIcons from '@/components/quiz/QuizIcons.vue';
import type { CatalogTreeDirectory, CatalogTreeFile } from './catalogTree';
import { collectCatalogFiles } from './catalogTree';
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{
  node: CatalogTreeDirectory;
  expandedKeys: Set<string>;
  orphanTitle: string;
  quizActions?: boolean;
}>();

const emit = defineEmits<{
  toggle: [key: string];
  'file-selected': [file: CatalogTreeFile];
  batch: [files: CatalogTreeFile[], mode: 'sequential' | 'random'];
}>();
const { t } = useI18n();

function descendants(): CatalogTreeFile[] {
  return collectCatalogFiles(props.node.children);
}
</script>

<template>
  <SidebarTreeNode
    :label="node.label"
    :expanded="expandedKeys.has(node.key)"
    :is-orphan="node.isOrphan"
    :orphan-title="orphanTitle"
    @toggle="emit('toggle', node.key)"
  >
    <template v-if="quizActions" #actions>
      <span class="ml-auto flex items-center gap-0.5" @click.stop>
        <button
          class="p-0.5 rounded text-text-3 hover:text-brand-2 transition-colors cursor-pointer"
          :title="t('quiz.sequential')"
          @click="emit('batch', descendants(), 'sequential')"
        >
          <QuizIcons icon="sequential" />
        </button>
        <button
          class="p-0.5 rounded text-text-3 hover:text-brand-2 transition-colors cursor-pointer"
          :title="t('quiz.random')"
          @click="emit('batch', descendants(), 'random')"
        >
          <QuizIcons icon="random" />
        </button>
      </span>
    </template>

    <template v-for="child in node.children" :key="child.key">
      <CatalogTreeBranch
        v-if="child.type === 'directory'"
        :node="child"
        :expanded-keys="expandedKeys"
        :orphan-title="orphanTitle"
        :quiz-actions="quizActions"
        @toggle="emit('toggle', $event)"
        @file-selected="emit('file-selected', $event)"
        @batch="(files, mode) => emit('batch', files, mode)"
      />
      <button
        v-else
        class="block w-full text-left py-1 text-xs text-text-2 hover:text-brand-2 transition-colors cursor-pointer truncate font-mono"
        @click="emit('file-selected', child)"
      >
        {{ quizActions ? child.name.replace(/\.json$/, '') : child.name }}
      </button>
    </template>
  </SidebarTreeNode>
</template>
