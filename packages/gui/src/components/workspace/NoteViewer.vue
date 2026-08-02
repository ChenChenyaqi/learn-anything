<script setup lang="ts">
// Read-only markdown note viewer. Loads a file's raw content via
// `useFileContent` and renders it with the shared `markdown-it` instance. The
// `.prose` styles in main.css scope the visual treatment; code blocks inside
// notes are highlighted by highlight.js through the markdown `highlight`
// option.
//
// Edit/save is deferred — there is no frontend write command yet, so this view
// is strictly read-only for Phase 2.

import { computed } from 'vue';
import { renderMarkdown } from '@/lib/markdown';
import { useFileContent } from './useFileContent';

const props = defineProps<{
  apiPath: string | null;
  workingFolder: string | null;
}>();

const { content, loading, error } = useFileContent(
  () => props.apiPath,
  () => props.workingFolder,
);

const fileName = computed(() => props.apiPath?.split('/').pop() ?? '');
const html = computed(() => (content.value ? renderMarkdown(content.value) : ''));
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div v-if="loading" class="grid h-full place-items-center opacity-60">Loading…</div>

    <div
      v-else-if="error"
      class="m-5 max-w-lg rounded-[10px] border border-(--color-accent) bg-(--color-accent-soft) p-4"
    >
      <pre class="whitespace-pre-wrap font-sans text-sm">{{ error.replace(/^\w+\|/, '') }}</pre>
    </div>

    <div v-else-if="content === null" class="grid h-full place-items-center opacity-60">
      File not found.
    </div>

    <div v-else class="py-5">
      <!-- toolbar -->
      <div class="mb-4 flex items-center gap-2 text-xs">
        <span class="font-mono text-(--color-accent)">markdown</span>
        <span class="font-mono text-text-3">·</span>
        <span class="truncate font-mono text-(--color-pencil)">{{ fileName }}</span>
      </div>

      <div class="prose" v-html="html" />
    </div>
  </div>
</template>
