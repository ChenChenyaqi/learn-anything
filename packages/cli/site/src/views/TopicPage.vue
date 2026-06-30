<script setup lang="ts">
import { computed, ref, inject, type Ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { loadTopic, loadKnowledgeMap, getDataVersion } from '@/composables/useTopicData';
import ContentViewer from '@/components/content/ContentViewer.vue';
import TocLayout from '@/components/content/TocLayout.vue';
import ViewModeToggle from '@/components/content/ViewModeToggle.vue';
import TopicProgressView from '@/components/stats/TopicProgressView.vue';
import type { SelectedFilePayload } from '@/composables/useTopicData';
import type { ViewMode } from '@/composables/useViewMode';
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps<{ slug: string }>();

const { t } = useI18n();

const state = computed(() => {
  void getDataVersion();
  return loadTopic(props.slug);
});
const knowledgeMapRaw = computed(() => {
  void getDataVersion();
  return loadKnowledgeMap(props.slug);
});

const knowledgeMapHtml = computed(() => {
  const raw = knowledgeMapRaw.value;
  if (!raw) return '';
  return renderMarkdown(raw);
});

/* --- Receive file selection from sidebar via provide/inject --- */
const selectedFile = inject<Ref<SelectedFilePayload | null>>('topicSelectedFile', ref(null));

/* --- View-mode toggle (Map / Progress) shared via provide/inject --- */
const viewMode = inject<Ref<ViewMode>>('viewMode', ref<ViewMode>('map'));

const showKnowledgeMap = computed(() => !selectedFile.value);
</script>

<template>
  <!-- Topic not found -->
  <div v-if="!state" class="flex flex-col items-center justify-center py-24 text-center">
    <div class="text-4xl mb-4 opacity-60 select-none">🔍</div>
    <p class="text-base text-(--color-pencil)">{{ t('topic.notFound') }}: {{ slug }}</p>
  </div>

  <!-- Topic content -->
  <div v-else>
    <!-- Topic overview: toggle between Knowledge Map (markdown) and Progress (data).
         The Progress view is width-constrained to the prose reading measure. -->
    <template v-if="showKnowledgeMap">
      <div :class="viewMode === 'progress' ? 'max-w-4xl mx-auto' : ''">
        <div class="flex justify-end mb-6">
          <ViewModeToggle />
        </div>
        <TocLayout v-if="viewMode === 'map'" :html="knowledgeMapHtml" />
        <TopicProgressView v-else :state="state" />
      </div>
    </template>

    <!-- File content -->
    <ContentViewer v-else :file="selectedFile" />
  </div>
</template>
