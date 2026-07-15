<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getDataVersion, loadCatalog, loadTopic } from '@/composables/useTopicData';
import CatalogTree from '@/components/sidebar/CatalogTree.vue';
import { buildCatalogTree, type CatalogTreeFile } from '@/components/sidebar/catalogTree';

const props = defineProps<{ topicSlug: string; selectedFilePath?: string | null }>();
const emit = defineEmits<{
  'file-selected': [file: { path: string; type: 'markdown' }];
  'knowledge-map': [];
}>();
const { t } = useI18n();

const state = computed(() => {
  void getDataVersion();
  return loadTopic(props.topicSlug);
});
const nodes = computed(() => {
  void getDataVersion();
  return buildCatalogTree(loadCatalog(props.topicSlug), 'session', props.topicSlug, state.value);
});

function selectFile(file: CatalogTreeFile) {
  emit('file-selected', { path: file.path, type: 'markdown' });
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <button
      class="w-full text-left text-sm font-semibold text-brand-2 hover:text-brand-1 transition-colors cursor-pointer mb-3"
      @click="emit('knowledge-map')"
    >
      {{ state?.topic || topicSlug }}
    </button>
    <CatalogTree
      :nodes="nodes"
      :selected-file-path="selectedFilePath"
      :empty-label="t('sidebar.noNotes')"
      @file-selected="selectFile"
    />
  </nav>
</template>
