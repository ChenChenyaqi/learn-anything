<script setup lang="ts">
// The knowledge-map panel — the default landing view for a topic workspace.
//
// Renders entirely from the topic's `StateV1` (no markdown): a header with the
// overall mastery summary + progress bar, a colour legend, a heatmap cluster
// row (one cluster per domain, one square per concept), and a detailed concept
// list grouped by domain with status dots + confidence/practice metadata.
//
// Concept rows are display-only for now: note files are named with a date
// suffix (`sessions/<domain>/<concept>-YYYY-MM-DD.md`), so a concept slug can't
// be resolved to a file path without listing the directory. Users open notes
// via the file tree; concept→note linking lands in a later refinement.
// Mirrors the design mockup lines 713-857.

import { useI18n } from 'vue-i18n';
import { statusDot, statusSquare, statusLabelKey, domainMastery } from '@/lib/status';
import { masteryBar, masteryBarFill } from '@/lib/ui';
import type { Concept, StateV1 } from '@/lib/commands';

const { t } = useI18n();

defineProps<{
  state: StateV1;
  overall: {
    total: number;
    mastered: number;
    inProgress: number;
    needsPractice: number;
    unexplored: number;
    percentage: number;
  };
}>();

/** Right-aligned mono metadata line for a concept row. */
function conceptInfo(c: Concept): string {
  if (c.status === 'unexplored') return t('workspace.status.unexplored');
  const parts = [
    t(statusLabelKey(c.status)),
    t('workspace.confidence', { value: c.confidence.toFixed(2) }),
  ];
  if (c.practice_count > 0) parts.push(t('workspace.practiceCount', { count: c.practice_count }));
  if (c.explain_count > 0) parts.push(t('workspace.explainCount', { count: c.explain_count }));
  return parts.join(' · ');
}
</script>

<template>
  <div class="h-full overflow-y-auto py-5 pr-5">
    <!-- header -->
    <div class="mb-1 font-mono text-xs text-(--color-accent)">{{ t('workspace.knowledgeMap') }}</div>
    <h1 class="m-0 text-2xl font-semibold tracking-tight">{{ state.topic }}</h1>
    <p class="mt-1.5 text-sm text-(--color-pencil)">
      {{
        t('workspace.overallSummary', {
          mastered: overall.mastered,
          inProgress: overall.inProgress,
          needsPractice: overall.needsPractice,
          unexplored: overall.unexplored,
        })
      }}
    </p>
    <div :class="masteryBar" class="mt-4">
      <i :class="masteryBarFill" :style="{ width: overall.percentage + '%' }" />
    </div>

    <!-- legend -->
    <div
      class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-(--color-pencil)"
    >
      <span class="flex items-center gap-1.5"
        ><span :class="statusSquare('mastered')" />{{ t('workspace.status.mastered') }}</span
      >
      <span class="flex items-center gap-1.5"
        ><span :class="statusSquare('in_progress')" />{{ t('workspace.status.inProgress') }}</span
      >
      <span class="flex items-center gap-1.5"
        ><span :class="statusSquare('needs_practice')" />{{ t('workspace.status.needsPractice') }}</span
      >
      <span class="flex items-center gap-1.5"
        ><span :class="statusSquare('unexplored')" />{{ t('workspace.status.unexplored') }}</span
      >
    </div>

    <!-- heatmap clusters -->
    <div class="mt-7 flex flex-wrap gap-8">
      <div v-for="domain in state.domains" :key="domain.slug">
        <div class="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-3">
          {{ domain.name }} · {{ domainMastery(domain).mastered }}/{{ domainMastery(domain).total }}
        </div>
        <div class="flex gap-1">
          <span
            v-for="c in domain.concepts"
            :key="c.slug"
            :class="statusSquare(c.status)"
            :title="c.name"
          />
        </div>
      </div>
    </div>

    <!-- detailed concept list -->
    <div class="mt-9 flex flex-col gap-7">
      <section v-for="domain in state.domains" :key="domain.slug">
        <h2 class="m-0 mb-3 font-mono text-xs uppercase tracking-wider text-text-3">
          {{ domain.name }}
        </h2>
        <ul class="m-0 flex list-none flex-col gap-px p-0">
          <li
            v-for="c in domain.concepts"
            :key="c.slug"
            class="rounded-r-lg py-2.5 pl-4 pr-2"
          >
            <div class="flex items-center gap-3">
              <span :class="statusDot(c.status)" />
              <span
                class="flex-1 text-sm"
                :class="c.status === 'unexplored' ? 'text-(--color-pencil)' : ''"
                >{{ c.name }}</span
              >
              <span class="font-mono text-xs text-(--color-pencil)">{{ conceptInfo(c) }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
