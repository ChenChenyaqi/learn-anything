<script setup lang="ts">
// The topic workspace: the IDE-style view shown when a topic is opened.
//
// Two-column internal layout: [file-tree sidebar | editor pane]. The right-hand
// Agent panel is owned by MainView. Data comes from `useTopicData` (the full
// `siteTopicData` payload); the three file trees are pre-built from `files`
// via `buildFileTree` and handed to the sidebar.
//
// The editor pane switches on the route's `currentPanel`:
//   - {kind:'map'}    → KnowledgeMap (the default landing view)
//   - {kind:'note'|'code', fileId} → placeholder (content lands in Phase 2)
//
// Four states: loading / error / no-data / normal — matching OverviewView's
// shape so the experience stays consistent across the route switch.

import { computed } from 'vue';
import { useWorkspaceNav } from '@/composables/useWorkspaceNav';
import { buildFileTree, type TreeNode } from './buildFileTree';
import { useTopicData } from './useTopicData';
import WorkspaceSidebar, { type FileAxis } from './WorkspaceSidebar.vue';
import KnowledgeMap from './KnowledgeMap.vue';
import { btnSecondary } from '@/lib/ui';

const props = defineProps<{ workingFolder: string | null }>();

const { currentSlug, currentPanel, openOverview } = useWorkspaceNav();
const { data, loading, error, overall } = useTopicData(currentSlug, () => props.workingFolder);

/** The three recursive trees, rebuilt only when the file payload changes. */
const trees = computed<Record<FileAxis, TreeNode[]>>(() => {
  const f = data.value?.files;
  return {
    sessions: f ? buildFileTree(f.sessions) : [],
    exercises: f ? buildFileTree(f.exercises) : [],
    quizzes: f ? buildFileTree(f.quizzes) : [],
  };
});

const topicName = computed(() => data.value?.state.topic ?? currentSlug.value ?? '');

/** The file path of the currently-open note/code, or null when on the map. */
const activePath = computed(() => {
  const p = currentPanel.value;
  return p && p.kind !== 'map' ? p.fileId : null;
});

/** Last path segment of the open file, for the placeholder header. */
const activeFileName = computed(() => {
  const p = activePath.value;
  return p ? p.split('/').pop() : '';
});

function cleanError(msg: string): string {
  return msg.replace(/^\w+\|/, '');
}
</script>

<template>
  <div v-if="loading" class="grid h-full place-items-center opacity-60">Loading…</div>

  <div
    v-else-if="error"
    class="max-w-lg rounded-[10px] border border-(--color-accent) bg-(--color-accent-soft) p-4"
  >
    <p>Couldn't load this topic:</p>
    <pre class="my-2 whitespace-pre-wrap font-sans text-sm">{{ cleanError(error) }}</pre>
    <button type="button" :class="[btnSecondary, 'px-3 py-1.5 text-xs']" @click="openOverview">
      Back to topics
    </button>
  </div>

  <div v-else-if="!data" class="grid h-full place-items-center opacity-60">Topic not found.</div>

  <div v-else class="flex h-full">
    <WorkspaceSidebar :trees="trees" :topic-name="topicName" :active-path="activePath" />

    <!-- editor pane -->
    <div class="flex min-w-0 flex-1 flex-col pl-5">
      <KnowledgeMap
        v-if="!currentPanel || currentPanel.kind === 'map'"
        :state="data.state"
        :overall="overall"
      />

      <!-- note/code placeholder (Phase 2 fills real content) -->
      <div v-else class="py-5">
        <div class="mb-1 font-mono text-xs text-(--color-accent)">{{ currentPanel.kind }}</div>
        <h1 class="m-0 text-xl font-semibold tracking-tight">{{ activeFileName }}</h1>
        <p class="mt-2 text-sm text-(--color-pencil)">Content loads in Phase 2.</p>
      </div>
    </div>
  </div>
</template>
