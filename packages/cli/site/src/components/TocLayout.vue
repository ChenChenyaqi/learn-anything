<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import TableOfContents from './TableOfContents.vue';
import { useToc } from '../composables/useToc';

const props = defineProps<{ html: string }>();

const contentRef = ref<HTMLElement>();
const { headings, activeId, refresh, scrollTo } = useToc(contentRef);

watch(
  () => props.html,
  () => nextTick(() => refresh()),
  { immediate: true },
);
</script>

<template>
  <div class="xl:flex xl:justify-center xl:gap-8">
    <article
      ref="contentRef"
      class="prose-content xl:mx-0! xl:min-w-0 xl:flex-1"
      v-html="html"
    />
    <aside class="hidden shrink-0 xl:block w-48 2xl:w-64">
      <div class="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <TableOfContents
          :headings="headings"
          :active-id="activeId"
          @navigate="scrollTo"
        />
      </div>
    </aside>
  </div>
</template>
