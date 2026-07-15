<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getDataVersion, loadCatalog, loadTopic } from '@/composables/useTopicData';
import { isMarkdownFile } from '@/utils/markdown';
import CatalogTree from '@/components/sidebar/CatalogTree.vue';
import { buildCatalogTree, type CatalogTreeFile } from '@/components/sidebar/catalogTree';

const props = defineProps<{ topicSlug: string; selectedFilePath?: string | null }>();
const emit = defineEmits<{
  'file-selected': [file: { path: string; type: 'markdown' | 'code' }];
}>();
const { t } = useI18n();

const nodes = computed(() => {
  void getDataVersion();
  return buildCatalogTree(
    loadCatalog(props.topicSlug),
    'exercise',
    props.topicSlug,
    loadTopic(props.topicSlug),
  );
});

function selectFile(file: CatalogTreeFile) {
  emit('file-selected', {
    path: file.path,
    type: isMarkdownFile(file.name) ? 'markdown' : 'code',
  });
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <CatalogTree
      :nodes="nodes"
      :selected-file-path="selectedFilePath"
      :empty-label="t('sidebar.noExercises')"
      @file-selected="selectFile"
    />
  </nav>
</template>
