<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown, highlightCode, getFileExtension } from '../utils/markdown';
import type { SelectedFilePayload } from '../composables/useTopicData';
import TocLayout from './TocLayout.vue';

const props = defineProps<{
  file: SelectedFilePayload | null;
}>();

const fileDisplayName = computed(() => {
  if (!props.file) return '';
  return props.file.path.split('/').pop() || '';
});

const fileExt = computed(() => getFileExtension(fileDisplayName.value));

const hasContent = computed(() => props.file?.content !== undefined);

const renderedHtml = computed(() => {
  if (props.file?.content === undefined) return '';
  if (props.file.type === 'markdown') return renderMarkdown(props.file.content);
  return highlightCode(props.file.content, fileExt.value);
});

const isMd = computed(() => props.file?.type === 'markdown');
</script>

<template>
  <div class="h-full">
    <div v-if="!file" class="flex items-center justify-center h-full min-h-75 text-sm text-text-3">
      Select a file from the sidebar to view its content
    </div>

    <!-- Loading placeholder — normally covered by the overlay -->
    <div v-else-if="!hasContent" class="prose-content space-y-3" aria-hidden="true">
      <div class="h-5 w-2/3 rounded bg-(--color-divider)" />
      <div class="h-3 w-full rounded bg-(--color-divider)" />
      <div class="h-3 w-full rounded bg-(--color-divider)" />
      <div class="h-3 w-4/5 rounded bg-(--color-divider)" />
    </div>

    <!-- Markdown: VitePress-style prose + right-side TOC outline -->
    <TocLayout v-else-if="isMd" :html="renderedHtml" />

    <!-- Code: VitePress code block style -->
    <div v-else class="prose-content rounded-lg overflow-hidden bg-(--color-bg-alt)">
      <div class="flex items-center justify-between px-5 py-2 bg-transparent">
        <span class="text-xs text-text-3 font-mono">{{ fileDisplayName }}</span>
      </div>
      <pre
        class="m-0! p-0! bg-transparent! text-left overflow-x-auto"
      ><code class="block px-6! py-5! leading-[1.7] font-mono text-[0.875em] text-text-2" v-html="renderedHtml" /></pre>
    </div>
  </div>
</template>
