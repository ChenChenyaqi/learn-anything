<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from '../../composables/useI18n';
import {
  scanExercises,
  scanRootExercises,
  loadFileContent,
  getDataVersion,
} from '../../composables/useTopicData';
import type { ExerciseGroup, ExerciseFile } from '../../composables/useTopicData';
import { isMarkdownFile } from '../../utils/markdown';

const props = defineProps<{
  topicSlug: string;
  selectedFilePath?: string | null;
}>();

const emit = defineEmits<{
  'file-selected': [file: { path: string; content: string; type: 'markdown' | 'code' }];
}>();

const { t } = useI18n();

const expandedConcepts = ref<Set<string>>(new Set());

const exerciseGroups = computed<ExerciseGroup[]>(() => {
  void getDataVersion();
  return scanExercises(props.topicSlug);
});

const rootExercises = computed<ExerciseFile[]>(() => {
  void getDataVersion();
  return scanRootExercises(props.topicSlug);
});

watch(
  () => [props.topicSlug, props.selectedFilePath] as const,
  ([slug, filePath]) => {
    expandedConcepts.value = new Set();
    if (!slug) return;

    if (filePath) {
      const groups = scanExercises(slug);
      for (const group of groups) {
        if (group.files.some((f) => f.path === filePath)) {
          expandedConcepts.value.add(group.conceptSlug);
          return;
        }
      }
    }
  },
  { immediate: true },
);

function toggleConcept(conceptSlug: string) {
  const s = new Set(expandedConcepts.value);
  if (s.has(conceptSlug)) s.delete(conceptSlug);
  else s.add(conceptSlug);
  expandedConcepts.value = s;
}

async function selectExerciseFile(file: ExerciseFile) {
  const content = await loadFileContent(file.path);
  if (content === null) return;
  const type = isMarkdownFile(file.name) ? 'markdown' : 'code';
  emit('file-selected', { path: file.path, content, type });
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <div v-if="exerciseGroups.length > 0" class="space-y-px">
      <div v-for="group in exerciseGroups" :key="group.conceptSlug">
        <button
          class="w-full flex items-center gap-1.5 py-1 text-sm font-medium transition-colors cursor-pointer"
          :class="
            expandedConcepts.has(group.conceptSlug)
              ? 'text-text-1'
              : 'text-text-2 hover:text-text-1'
          "
          @click="toggleConcept(group.conceptSlug)"
        >
          <span
            class="text-[10px] transition-transform duration-150 shrink-0 w-3 text-center"
            :class="expandedConcepts.has(group.conceptSlug) ? 'rotate-90' : ''"
          >▶</span>
          <span class="truncate">{{ group.conceptName }}</span>
        </button>

        <div v-if="expandedConcepts.has(group.conceptSlug)" class="pl-4 mb-1 space-y-px">
          <button
            v-for="file in group.files"
            :key="file.path"
            class="block w-full text-left py-1 text-xs text-text-2 hover:text-text-1 transition-colors cursor-pointer truncate font-mono"
            @click="selectExerciseFile(file)"
          >
            {{ file.name }}
          </button>
        </div>
      </div>
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

    <div v-if="exerciseGroups.length === 0 && rootExercises.length === 0" class="py-2 text-xs text-text-3">
      {{ t('sidebar.noExercises') }}
    </div>
  </nav>
</template>
