<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAutoExpand } from './useAutoExpand';
import { loadTopicFiles, getDataVersion } from '@/composables/useTopicData';
import { isMarkdownFile } from '@/utils/markdown';
import { buildFileTree, ancestorDirPaths, type FileLeaf } from '@/components/sidebar/tabs/buildFileTree';
import FileTreeBranch from '@/components/sidebar/tabs/FileTreeBranch.vue';

const props = defineProps<{
  topicSlug: string;
  selectedFilePath?: string | null;
}>();

const emit = defineEmits<{
  'file-selected': [file: { path: string; type: 'markdown' | 'code' }];
}>();

const { t } = useI18n();

const nodes = computed(() => {
  void getDataVersion();
  return buildFileTree(loadTopicFiles(props.topicSlug)?.exercises ?? []);
});

const firstDirPath = computed(() => {
  const first = nodes.value.find((n) => n.type === 'dir');
  return first?.path;
});

const {
  expanded: expandedKeys,
  toggle: toggleExpansion,
  add: addExpansion,
} = useAutoExpand(
  'exercises',
  () => props.topicSlug,
  () => firstDirPath.value,
);

const selectedRelPath = computed(() => {
  if (!props.selectedFilePath) return null;
  const prefix = `/topics/${props.topicSlug}/`;
  return props.selectedFilePath.startsWith(prefix)
    ? props.selectedFilePath.slice(prefix.length)
    : null;
});

watch(
  selectedRelPath,
  (relPath) => {
    if (!relPath) return;
    for (const dirPath of ancestorDirPaths(relPath)) {
      addExpansion(props.topicSlug, dirPath);
    }
  },
  { immediate: true },
);

function onToggle(key: string) {
  toggleExpansion(props.topicSlug, key);
}

function onFileSelected(file: FileLeaf) {
  emit('file-selected', {
    path: `/topics/${props.topicSlug}/${file.path}`,
    type: isMarkdownFile(file.name) ? 'markdown' : 'code',
  });
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <FileTreeBranch
      v-if="nodes.length > 0"
      :nodes="nodes"
      :expanded-keys="expandedKeys"
      :selected-file-path="selectedRelPath"
      mono
      @toggle="onToggle"
      @file-selected="onFileSelected"
    />
    <div v-else class="py-2 text-xs text-text-3">{{ t('sidebar.noExercises') }}</div>
  </nav>
</template>
