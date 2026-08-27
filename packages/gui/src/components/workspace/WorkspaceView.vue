<script setup lang="ts">
// The topic workspace: the IDE-style view shown when a topic is opened.
//
// Two-column internal layout: [file-tree sidebar | editor pane]. The right-hand
// Agent panel is owned by MainView. Data comes from `useTopicData` (the full
// `siteTopicData` payload); the three file trees are pre-built from `files`
// via `buildFileTree` and handed to the sidebar.
//
// The editor pane switches on the route's `currentPanel`:
//   - {kind:'map'}               → KnowledgeMap (the default landing view)
//   - {kind:'note'|'code', fileId} → NoteViewer (.md) or CodeViewer (else)
//
// Four states: loading / error / no-data / normal — matching OverviewView's
// shape so the experience stays consistent across the route switch.

import { computed } from 'vue';
import { useWorkspaceNav } from '@/composables/useWorkspaceNav';
import { buildFileTree, type TreeNode } from './buildFileTree';
import { useTopicData } from './useTopicData';
import WorkspaceSidebar, { type FileAxis } from './WorkspaceSidebar.vue';
import KnowledgeMap from './KnowledgeMap.vue';
import NoteViewer from './NoteViewer.vue';
import CodeViewer from './CodeViewer.vue';
import QuizViewer from './quiz/QuizViewer.vue';
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

/** The file path of the currently-open note/code/quiz, or null when on the map. */
const activePath = computed(() => {
  const p = currentPanel.value;
  // quiz batch sessions have no single fileId; note/code/single-quiz do.
  return p && p.kind !== 'map' ? (p.fileId ?? null) : null;
});

/** API path for `siteFileContent`: `/topics/<slug>/<axis-relative path>`. */
const apiPath = computed(() => {
  const p = activePath.value;
  const slug = currentSlug.value;
  return p && slug ? `/topics/${slug}/${p}` : null;
});

/** `.md` → markdown viewer, everything else → code viewer. */
const isMarkdown = computed(() => activePath.value?.endsWith('.md') ?? false);

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

  <div v-else class="workspace-view flex h-full">
    <WorkspaceSidebar :trees="trees" :topic-name="topicName" :active-path="activePath" />

    <!-- editor pane -->
    <div class="flex min-w-0 flex-1 flex-col pl-5">
      <KnowledgeMap
        v-if="!currentPanel || currentPanel.kind === 'map'"
        :state="data.state"
        :overall="overall"
      />

      <QuizViewer
        v-else-if="currentPanel.kind === 'quiz'"
        :panel="currentPanel"
        :slug="currentSlug"
        :working-folder="workingFolder"
      />

      <NoteViewer v-else-if="isMarkdown" :api-path="apiPath" :working-folder="workingFolder" />
      <CodeViewer v-else :api-path="apiPath" :working-folder="workingFolder" />
    </div>
  </div>
</template>
