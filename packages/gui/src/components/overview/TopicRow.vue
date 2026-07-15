<script setup lang="ts">
// One topic row in the overview list.
//
// Renders the ordinal (01, 02…), name, a mono stat line ("X/Y mastered · Z%",
// or "not started" when nothing is mastered yet), a mini mastery bar, and the
// domain names as a one-line description. The whole row is a clickable,
// keyboard-activatable button (role + Enter/Space) that opens the topic's
// workspace via `useWorkspaceNav.openTopic`.
//
// `<h3>` is kept for document outline; because `<button>` only accepts phrasing
// content, the row is an `<li role="button">` instead of a literal `<button>`.
import { computed } from 'vue';
import { type SiteTopicSummary } from '@/lib/commands';
import { rowMargin, masteryBar, masteryBarFill } from '@/lib/ui';
import { useWorkspaceNav } from '@/composables/useWorkspaceNav';

const props = defineProps<{
  summary: SiteTopicSummary;
  /** 0-based position in the list; rendered as a 2-digit ordinal (01, 02…). */
  index: number;
}>();

const { openTopic } = useWorkspaceNav();

const ordinal = computed(() => String(props.index + 1).padStart(2, '0'));

const statLabel = computed(() => {
  const { masteredCount, totalConcepts, percentage } = props.summary;
  if (masteredCount === 0) return `${masteredCount}/${totalConcepts} mastered · not started`;
  return `${masteredCount}/${totalConcepts} mastered · ${percentage}%`;
});

const description = computed(() => props.summary.domainNames.join(', '));

function open() {
  openTopic(props.summary.slug);
}
</script>

<template>
  <li
    role="button"
    tabindex="0"
    :class="[
      rowMargin,
      'flex cursor-pointer items-baseline gap-4 rounded-r-lg py-3.5 px-4 transition-colors hover:bg-(--color-surface-hover)',
    ]"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <span class="w-6 shrink-0 font-mono text-xs text-text-3">{{ ordinal }}</span>
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-4">
        <h3 class="m-0 text-base font-semibold">{{ summary.name }}</h3>
        <span class="font-mono text-xs text-(--color-pencil)">{{ statLabel }}</span>
      </div>
      <div :class="masteryBar" class="mt-2">
        <i :class="masteryBarFill" :style="{ width: summary.percentage + '%' }" />
      </div>
      <p v-if="description" class="m-0 mt-1.5 text-xs text-(--color-pencil)">{{ description }}</p>
    </div>
  </li>
</template>
