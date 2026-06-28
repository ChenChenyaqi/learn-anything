<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAutoExpand } from './useAutoExpand';
import {
  loadTopic,
  scanExercises,
  scanRootExercises,
  getDataVersion,
} from '@/composables/useTopicData';
import type { ExerciseGroup, ExerciseFile } from '@/composables/useTopicData';
import { isMarkdownFile } from '@/utils/markdown';
import SidebarTreeNode from '@/components/sidebar/SidebarTreeNode.vue';

const props = defineProps<{
  topicSlug: string;
  selectedFilePath?: string | null;
}>();

const emit = defineEmits<{
  'file-selected': [file: { path: string; type: 'markdown' | 'code' }];
}>();

const { t } = useI18n();

type ExerciseGroupWithFlag = ExerciseGroup & { isOrphan: boolean };

/* Mirror the actual exercises/ folders; state.json supplies the concept name
   and ordering, folders absent from state.json are shown as orphans. */
const exerciseGroups = computed<ExerciseGroupWithFlag[]>(() => {
  void getDataVersion();
  const groups = scanExercises(props.topicSlug);
  const state = loadTopic(props.topicSlug);

  const knownSlugs = new Set<string>();
  const orderMap = new Map<string, number>();
  let idx = 0;
  for (const d of state?.domains ?? []) {
    for (const c of d.concepts) {
      knownSlugs.add(c.slug);
      orderMap.set(c.slug, idx++);
    }
  }

  return groups
    .map((g) => ({ ...g, isOrphan: !knownSlugs.has(g.conceptSlug) }))
    .sort((a, b) => {
      const oa = orderMap.get(a.conceptSlug) ?? Number.MAX_SAFE_INTEGER;
      const ob = orderMap.get(b.conceptSlug) ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.conceptSlug.localeCompare(b.conceptSlug);
    });
});

const rootExercises = computed<ExerciseFile[]>(() => {
  void getDataVersion();
  return scanRootExercises(props.topicSlug);
});

const {
  expanded: expandedConcepts,
  toggle: toggleExpansion,
  add: addExpansion,
} = useAutoExpand(
  'exercises',
  () => props.topicSlug,
  () => exerciseGroups.value[0]?.conceptSlug,
);

/* Selecting a file: expand its parent concept without collapsing others. */
watch(
  () => props.selectedFilePath,
  (filePath) => {
    if (!filePath || !props.topicSlug) return;
    const groups = scanExercises(props.topicSlug);
    for (const group of groups) {
      if (group.files.some((f) => f.path === filePath)) {
        addExpansion(props.topicSlug, group.conceptSlug);
        return;
      }
    }
  },
  { immediate: true },
);

function toggleConcept(conceptSlug: string) {
  toggleExpansion(props.topicSlug, conceptSlug);
}

function selectExerciseFile(file: ExerciseFile) {
  const type = isMarkdownFile(file.name) ? 'markdown' : 'code';
  emit('file-selected', { path: file.path, type });
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <div v-if="exerciseGroups.length > 0" class="space-y-px">
      <SidebarTreeNode
        v-for="group in exerciseGroups"
        :key="group.conceptSlug"
        :label="group.conceptName"
        :expanded="expandedConcepts.has(group.conceptSlug)"
        :is-orphan="group.isOrphan"
        :orphan-title="t('sidebar.orphanTip')"
        @toggle="toggleConcept(group.conceptSlug)"
      >
        <div v-if="group.files.length === 0" class="py-1 text-[11px] text-text-3">
          {{ t('sidebar.noExercises') }}
        </div>
        <button
          v-for="file in group.files"
          :key="file.path"
          class="block w-full text-left py-1 text-xs text-text-2 hover:text-text-1 transition-colors cursor-pointer truncate font-mono"
          @click="selectExerciseFile(file)"
        >
          {{ file.name }}
        </button>
      </SidebarTreeNode>
    </div>

    <div v-if="rootExercises.length > 0" class="pt-2 mb-1 space-y-px">
      <button
        v-for="file in rootExercises"
        :key="file.path"
        class="block w-full text-left py-1 text-xs text-text-2 hover:text-text-1 transition-colors cursor-pointer truncate font-mono"
        @click="selectExerciseFile(file)"
      >
        {{ file.name }}
      </button>
    </div>

    <div
      v-if="exerciseGroups.length === 0 && rootExercises.length === 0"
      class="py-2 text-xs text-text-3"
    >
      {{ t('sidebar.noExercises') }}
    </div>
  </nav>
</template>
