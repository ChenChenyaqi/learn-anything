<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import type { TocItem } from '../composables/useToc';

defineProps<{
  headings: TocItem[];
  activeId: string;
}>();

const emit = defineEmits<{
  navigate: [id: string];
}>();

const { t } = useI18n();
</script>

<template>
  <nav v-if="headings.length" class="toc-nav" aria-label="Table of contents">
    <p class="mb-3 text-sm font-semibold text-text-1">{{ t('toc.title') }}</p>
    <ul class="border-l border-divider">
      <li v-for="h in headings" :key="h.id">
        <a
          :href="`#${h.id}`"
          class="block border-l-2 -ml-px py-1 pr-2 text-[13px] leading-6 transition-colors truncate"
          :style="{ paddingLeft: `${(h.level - 2) * 12 + 12}px` }"
          :class="
            h.id === activeId
              ? 'border-brand-2 text-brand-2 font-medium'
              : 'border-transparent text-text-3 hover:text-text-1'
          "
          @click.prevent="emit('navigate', h.id)"
        >
          {{ h.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>
