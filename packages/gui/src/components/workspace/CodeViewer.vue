<script setup lang="ts">
// Read-only code viewer with line numbers. Loads raw content via
// `useFileContent`, highlights it with highlight.js (language hinted from the
// file extension), and renders a fixed line-number gutter beside a
// horizontally-scrollable code pane. The gutter is a plain list of numbers
// sharing the code's line-height, so alignment holds as long as lines don't
// wrap (`white-space: pre` + `overflow-x: auto` on the code pane).

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { highlightCode, langForFile } from '@/lib/highlight';
import { useFileContent } from './useFileContent';

const { t } = useI18n();

const props = defineProps<{
  apiPath: string | null;
  workingFolder: string | null;
}>();

const { content, loading, error } = useFileContent(
  () => props.apiPath,
  () => props.workingFolder,
);

const fileName = computed(() => props.apiPath?.split('/').pop() ?? '');
const lang = computed(() => langForFile(fileName.value));

const highlighted = computed(() => {
  if (content.value === null) return '';
  return highlightCode(content.value, lang.value);
});

const lineCount = computed(() => {
  if (content.value === null) return 0;
  const n = content.value.split('\n').length;
  return content.value.endsWith('\n') ? n - 1 : n;
});
</script>

<template>
  <div class="h-full overflow-auto">
    <div v-if="loading" class="grid h-full place-items-center opacity-60">{{
      t('common.loading')
    }}</div>

    <div
      v-else-if="error"
      class="m-5 max-w-lg rounded-[10px] border border-(--color-accent) bg-(--color-accent-soft) p-4"
    >
      <pre class="whitespace-pre-wrap font-sans text-sm">{{ error.replace(/^\w+\|/, '') }}</pre>
    </div>

    <div v-else-if="content === null" class="grid h-full place-items-center opacity-60">
      {{ t('common.fileNotFound') }}
    </div>

    <div v-else class="py-3">
      <!-- toolbar -->
      <div class="mb-3 flex items-center gap-2 px-4 text-xs">
        <span class="font-mono text-(--color-accent)">{{ lang || 'text' }}</span>
        <span class="font-mono text-text-3">·</span>
        <span class="truncate font-mono text-(--color-pencil)">{{ fileName }}</span>
      </div>

      <!-- code + gutter -->
      <div class="code-wrap">
        <div class="gutter" aria-hidden="true">
          <span v-for="n in lineCount" :key="n">{{ n }}</span>
        </div>
        <pre class="code hljs"><code v-html="highlighted" /></pre>
      </div>
    </div>
  </div>
</template>
