<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import SidebarTreeNode from '@/components/sidebar/SidebarTreeNode.vue';
import type { Concept, ConceptStatus } from '@/composables/topicDataTypes';

defineProps<{ domains: { name: string; slug: string; concepts: Concept[] }[] }>();
const { t } = useI18n();

const collapsed = ref<Set<string>>(new Set());

function isExpanded(slug: string): boolean {
  return !collapsed.value.has(slug);
}

function toggle(slug: string): void {
  const next = new Set(collapsed.value);
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  collapsed.value = next;
}

const statusBarClass: Record<ConceptStatus, string> = {
  mastered: 'bg-mastered',
  in_progress: 'bg-(--color-progress)',
  needs_practice: 'bg-brand-2',
  unexplored: 'bg-(--color-text-3) opacity-30',
};
</script>

<template>
  <div class="space-y-1">
    <SidebarTreeNode
      v-for="domain in domains"
      :key="domain.slug"
      :label="domain.name"
      :expanded="isExpanded(domain.slug)"
      @toggle="toggle(domain.slug)"
    >
      <div
        v-for="concept in domain.concepts"
        :key="concept.slug"
        class="flex items-center gap-2.5 py-1 pr-1 group"
      >
        <span class="w-1 h-3.5 rounded-full shrink-0" :class="statusBarClass[concept.status]" />
        <span
          class="flex-1 min-w-0 truncate text-[13px] text-text-2 group-hover:text-text-1 transition-colors"
          >{{ concept.name }}</span
        >
        <span
          class="text-[11px] tabular-nums text-text-3 shrink-0"
          :title="t('topic.confidence')"
          >{{ Math.round(concept.confidence * 100) }}%</span
        >
      </div>
    </SidebarTreeNode>
  </div>
</template>
