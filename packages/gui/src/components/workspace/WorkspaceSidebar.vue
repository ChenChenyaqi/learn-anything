<script setup lang="ts">
// The workspace left sidebar: back-to-overview, the topic name (→ knowledge
// map), and a three-tab recursive file tree (Learn / Practice / Review ↔
// sessions / exercises / quizzes). Trees are pre-built by the parent from
// `siteTopicData().files` via `buildFileTree`; this component only owns the
// active-tab state + navigation.
//
// Axis → panel kind mapping: sessions (.md) → note, exercises → code,
// quizzes → quiz. On the quizzes tab, directory rows and an "All quizzes"
// header expose ▶ (sequential) / ⇄ (random) batch actions that collect the
// subtree's files into a queue panel.

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkspaceNav } from '@/composables/useWorkspaceNav';
import type { TreeNode, FileLeaf, DirNode } from './buildFileTree';
import { collectFiles } from './buildFileTree';
import FileTreeNode from './FileTreeNode.vue';
import QuizIcons from './quiz/QuizIcons.vue';
import type { QueueItem } from './quiz/types';

const { t } = useI18n();

export type FileAxis = 'sessions' | 'exercises' | 'quizzes';

const props = defineProps<{
  trees: Record<FileAxis, TreeNode[]>;
  topicName: string;
  activePath: string | null;
}>();

const { openOverview, openPanel } = useWorkspaceNav();

const activeTab = ref<FileAxis>('sessions');

// Labels resolve through i18n (computed) so the tab bar re-renders on a
// language switch.
const TABS = computed(() => [
  { axis: 'sessions' as const, label: t('workspace.tab.learn') },
  { axis: 'exercises' as const, label: t('workspace.tab.practice') },
  { axis: 'quizzes' as const, label: t('workspace.tab.review') },
]);

/** sessions → note, exercises → code, quizzes → quiz. */
const AXIS_KIND: Record<FileAxis, 'note' | 'code' | 'quiz'> = {
  sessions: 'note',
  exercises: 'code',
  quizzes: 'quiz',
};

function onOpen(leaf: FileLeaf) {
  openPanel({ kind: AXIS_KIND[activeTab.value], fileId: leaf.path });
}

/** Map a quiz file leaf to a queue item. Derives a concept label from the
 *  directory under `quizzes/` (best-effort — the file tree carries no rich
 *  concept metadata). Returns null for non-quiz files. */
function leafToQueueItem(leaf: FileLeaf): QueueItem | null {
  if (!leaf.path.endsWith('.json')) return null;
  const segments = leaf.path.split('/');
  segments.shift(); // drop "quizzes"
  const filename = segments.pop() ?? leaf.name;
  const conceptSlug = segments[0] ?? filename.replace(/\.json$/, '');
  return {
    concept_slug: conceptSlug,
    concept_name: conceptSlug,
    filename,
    path: leaf.path,
  };
}

function playLeaves(leaves: FileLeaf[], mode: 'sequential' | 'random') {
  const items = leaves.map(leafToQueueItem).filter((x): x is QueueItem => x !== null);
  if (items.length === 0) return;
  openPanel({ kind: 'quiz', mode, items });
}

function playDir(dirNode: DirNode, mode: 'sequential' | 'random') {
  playLeaves(collectFiles(dirNode.children), mode);
}

function playAll(mode: 'sequential' | 'random') {
  playLeaves(collectFiles(props.trees.quizzes), mode);
}
</script>

<template>
  <aside
    class="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-(--color-rule) pr-2"
  >
    <!-- back -->
    <button
      type="button"
      class="mb-3 inline-flex items-center gap-1 font-mono text-xs text-(--color-pencil) transition-colors hover:text-(--color-ink)"
      @click="openOverview"
    >
      ← All topics
    </button>

    <!-- topic name → knowledge map -->
    <button
      type="button"
      class="mb-2 block w-full rounded-r-lg py-1 pl-2 text-left text-sm font-semibold text-(--color-accent) transition-colors hover:text-brand-1"
      @click="openPanel({ kind: 'map' })"
    >
      {{ topicName }}
    </button>

    <!-- tab bar -->
    <div class="mb-2 flex gap-5 border-b border-(--color-rule) px-2">
      <button
        v-for="tab in TABS"
        :key="tab.axis"
        type="button"
        class="-mb-px border-b-2 pb-2 text-xs font-medium transition-colors"
        :class="
          activeTab === tab.axis
            ? 'border-b-(--color-accent) text-(--color-ink)'
            : 'border-b-transparent text-text-2 hover:text-(--color-ink)'
        "
        @click="activeTab = tab.axis"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- active tree -->
    <div class="px-2">
      <!-- "All quizzes" batch header (quizzes tab only) -->
      <div
        v-if="activeTab === 'quizzes' && trees.quizzes.length"
        class="mb-1.5 flex items-center justify-between px-1.5 py-1"
      >
        <span class="font-mono text-[10px] uppercase tracking-wider text-text-3">{{
          t('quiz.allQuizzes')
        }}</span>
        <span class="flex items-center gap-0.5">
          <button
            type="button"
            class="inline-flex h-5 w-5 items-center justify-center rounded text-text-3 transition-colors hover:bg-(--color-surface-hover) hover:text-(--color-accent)"
            :title="t('workspace.playAllSequential')"
            @click="playAll('sequential')"
          >
            <QuizIcons icon="sequential" />
          </button>
          <button
            type="button"
            class="inline-flex h-5 w-5 items-center justify-center rounded text-text-3 transition-colors hover:bg-(--color-surface-hover) hover:text-(--color-accent)"
            :title="t('workspace.playAllShuffled')"
            @click="playAll('random')"
          >
            <QuizIcons icon="random" />
          </button>
        </span>
      </div>

      <template v-if="trees[activeTab].length">
        <FileTreeNode
          v-for="node in trees[activeTab]"
          :key="node.path"
          :node="node"
          :active-path="activePath"
          :axis="activeTab"
          @open="onOpen"
        >
          <template #batchActions="{ node: dirNode }">
            <button
              type="button"
              class="inline-flex h-4 w-4 items-center justify-center rounded text-text-3 transition-colors hover:text-(--color-accent)"
              :title="t('workspace.playSequential')"
              @click.stop="playDir(dirNode, 'sequential')"
            >
              <QuizIcons icon="sequential" />
            </button>
            <button
              type="button"
              class="inline-flex h-4 w-4 items-center justify-center rounded text-text-3 transition-colors hover:text-(--color-accent)"
              :title="t('workspace.playShuffled')"
              @click.stop="playDir(dirNode, 'random')"
            >
              <QuizIcons icon="random" />
            </button>
          </template>
        </FileTreeNode>
      </template>
      <p v-else class="px-1.5 py-1 font-mono text-xs text-text-3">{{ t('workspace.noFiles') }}</p>
    </div>
  </aside>
</template>
