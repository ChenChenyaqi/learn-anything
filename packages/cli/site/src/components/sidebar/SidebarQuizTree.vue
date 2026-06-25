<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from '../../composables/useI18n';
import { useTreeExpansion } from '../../composables/useTreeExpansion';
import { fetchQuizList, type QuizFile, type QueueItem } from '../../composables/useQuiz';
import QuizIcons from '../quiz/QuizIcons.vue';

const props = defineProps<{
  topicSlug: string;
}>();

const emit = defineEmits<{
  'quiz-selected': [quiz: { path: string }];
  'quiz-batch-selected': [batch: { items: QueueItem[]; mode: 'sequential' | 'random' }];
}>();

const { t } = useI18n();

const {
  expanded: expandedConcepts,
  load: loadExpansion,
  toggle: toggleExpansion,
} = useTreeExpansion('quizzes');

const { groups, loading, error } = fetchQuizList(props.topicSlug);

const hasQuizzes = computed(() => groups.value.some((g) => g.files.length > 0));

const allItems = computed<QueueItem[]>(() => {
  const items: QueueItem[] = [];
  for (const group of groups.value) {
    for (const file of group.files) {
      items.push({
        concept_slug: group.concept_slug,
        concept_name: group.concept_name,
        filename: file.filename,
        path: file.path,
      });
    }
  }
  return items;
});

watch(
  groups,
  (groupList) => {
    if (!props.topicSlug || groupList.length === 0) return;
    const first = groupList[0]?.concept_slug;
    loadExpansion(props.topicSlug, first ? [first] : []);
  },
  { immediate: true },
);

function toggleConcept(conceptSlug: string) {
  toggleExpansion(props.topicSlug, conceptSlug);
}

function selectQuiz(file: QuizFile, conceptSlug: string) {
  emit('quiz-selected', { path: file.path });
}

function buildConceptItems(conceptSlug: string, conceptName: string, files: QuizFile[]): QueueItem[] {
  return files.map((f) => ({
    concept_slug: conceptSlug,
    concept_name: conceptName,
    filename: f.filename,
    path: f.path,
  }));
}

function emitBatch(items: QueueItem[], mode: 'sequential' | 'random') {
  emit('quiz-batch-selected', { items, mode });
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <div v-if="loading" class="py-2 text-xs text-text-3">…</div>

    <div v-else-if="error" class="py-2 text-xs text-text-3">
      {{ error }}
    </div>

    <div v-else-if="hasQuizzes" class="space-y-px">
      <!-- Topic-level header -->
      <div
        class="flex items-center justify-between py-1 mb-1"
      >
        <span class="text-xs font-medium uppercase tracking-wide text-text-3">{{ t('quiz.allQuizzes') }}</span>
        <div class="flex items-center gap-1">
          <button
            class="p-1 rounded text-text-3 hover:text-brand-2 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
            :title="t('quiz.sequential')"
            @click="emitBatch(allItems, 'sequential')"
          >
            <QuizIcons icon="sequential" />
          </button>
          <button
            class="p-1 rounded text-text-3 hover:text-brand-2 hover:bg-(--color-bg-soft) transition-colors cursor-pointer"
            :title="t('quiz.random')"
            @click="emitBatch(allItems, 'random')"
          >
            <QuizIcons icon="random" />
          </button>
        </div>
      </div>

      <div v-for="group in groups" :key="group.concept_slug">
        <button
          class="group/concept w-full flex items-center gap-1.5 py-1 text-sm font-medium transition-colors cursor-pointer"
          :class="
            expandedConcepts.has(group.concept_slug)
              ? 'text-text-1'
              : 'text-text-2 hover:text-text-1'
          "
          @click="toggleConcept(group.concept_slug)"
        >
          <span
            class="text-[10px] transition-transform duration-150 shrink-0 w-3 text-center"
            :class="expandedConcepts.has(group.concept_slug) ? 'rotate-90' : ''"
            >▶</span
          >
          <span class="truncate">{{ group.concept_name }}</span>
          <span
            class="ml-auto flex items-center gap-0.5"
            @click.stop
          >
            <button
              class="p-0.5 rounded text-text-3 hover:text-brand-2 transition-colors cursor-pointer"
              :title="t('quiz.sequential')"
              @click="emitBatch(buildConceptItems(group.concept_slug, group.concept_name, group.files), 'sequential')"
            >
              <QuizIcons icon="sequential" />
            </button>
            <button
              class="p-0.5 rounded text-text-3 hover:text-brand-2 transition-colors cursor-pointer"
              :title="t('quiz.random')"
              @click="emitBatch(buildConceptItems(group.concept_slug, group.concept_name, group.files), 'random')"
            >
              <QuizIcons icon="random" />
            </button>
          </span>
        </button>

        <div v-if="expandedConcepts.has(group.concept_slug)" class="pl-4 mb-1 space-y-px">
          <button
            v-for="file in group.files"
            :key="file.path"
            class="group/q w-full flex items-center gap-1.5 py-1 text-xs text-text-2 hover:text-brand-2 transition-colors cursor-pointer truncate font-mono"
            @click="selectQuiz(file, group.concept_slug)"
          >
            <span
              class="text-[10px] shrink-0 w-3 text-center text-text-3 group-hover/q:text-brand-2 transition-colors"
              >▶</span
            >
            <span class="truncate">{{ file.filename.replace(/\.json$/, '') }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-else class="py-2 text-xs text-text-3">
      {{ t('quiz.empty') }}
    </div>
  </nav>
</template>
