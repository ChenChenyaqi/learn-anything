<script setup lang="ts">
// The workspace left sidebar: back-to-overview, the topic name (→ knowledge
// map), and a three-tab recursive file tree (Learn / Practice / Review ↔
// sessions / exercises / quizzes). Trees are pre-built by the parent from
// `siteTopicData().files` via `buildFileTree`; this component only owns the
// active-tab state + navigation.
//
// Axis → panel kind mapping: sessions (.md) open as `note`, exercises/quizzes
// open as `code` (Phase 3 will add a dedicated `quiz` panel kind). Clicking a
// leaf navigates via `openPanel`. Mirrors mockup lines 331-530.

import { ref } from 'vue';
import { useWorkspaceNav } from '@/composables/useWorkspaceNav';
import type { TreeNode, FileLeaf } from './buildFileTree';
import FileTreeNode from './FileTreeNode.vue';

export type FileAxis = 'sessions' | 'exercises' | 'quizzes';

defineProps<{
  trees: Record<FileAxis, TreeNode[]>;
  topicName: string;
  activePath: string | null;
}>();

const { openOverview, openPanel } = useWorkspaceNav();

const activeTab = ref<FileAxis>('sessions');

const TABS: { axis: FileAxis; label: string }[] = [
  { axis: 'sessions', label: 'Learn' },
  { axis: 'exercises', label: 'Practice' },
  { axis: 'quizzes', label: 'Review' },
];

/** sessions → note, exercises/quizzes → code (Phase 3 adds a quiz kind). */
const AXIS_KIND: Record<FileAxis, 'note' | 'code'> = {
  sessions: 'note',
  exercises: 'code',
  quizzes: 'code',
};

function onOpen(leaf: FileLeaf) {
  openPanel({ kind: AXIS_KIND[activeTab.value], fileId: leaf.path });
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
        v-for="t in TABS"
        :key="t.axis"
        type="button"
        class="-mb-px border-b-2 pb-2 text-xs font-medium transition-colors"
        :class="
          activeTab === t.axis
            ? 'border-b-(--color-accent) text-(--color-ink)'
            : 'border-b-transparent text-text-2 hover:text-(--color-ink)'
        "
        @click="activeTab = t.axis"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- active tree -->
    <div class="px-2">
      <template v-if="trees[activeTab].length">
        <FileTreeNode
          v-for="node in trees[activeTab]"
          :key="node.path"
          :node="node"
          :active-path="activePath"
          @open="onOpen"
        />
      </template>
      <p v-else class="px-1.5 py-1 font-mono text-xs text-text-3">No files yet.</p>
    </div>
  </aside>
</template>
