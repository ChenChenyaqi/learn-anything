<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { StateV1 } from '@/composables/topicDataTypes';
import { computeTopicStats } from './useTopicStats';
import StatsHero from './StatsHero.vue';
import MasteryTree from './MasteryTree.vue';

const props = defineProps<{ state: StateV1 }>();
const { t } = useI18n();

const stats = computed(() => computeTopicStats(props.state));
</script>

<template>
  <div
    class="bg-(--color-bg-soft) rounded-xl border border-(--color-divider) shadow-sm overflow-hidden"
  >
    <!-- Hero: topic-scoped mastery ledger -->
    <StatsHero :stats="stats" />

    <!-- Per-domain breakdown -->
    <div v-if="stats.perDomain.length > 0" class="border-t border-(--color-divider) p-6">
      <p class="text-xs text-text-3 mb-3">{{ t('topic.byDomain') }}</p>
      <ul class="space-y-3.5">
        <li v-for="d in stats.perDomain" :key="d.slug">
          <div class="flex items-baseline justify-between gap-3 mb-1.5">
            <span class="text-[13px] font-medium text-text-1 truncate">{{ d.name }}</span>
            <span class="text-[11px] tabular-nums text-text-3 shrink-0">
              {{ d.mastered }}/{{ d.total }} · {{ d.pct }}%
            </span>
          </div>
          <div class="flex h-1.5 w-full rounded-full overflow-hidden bg-(--color-divider)">
            <div
              class="h-full bg-mastered transition-all duration-500"
              :style="{ flexGrow: d.mastered, flexBasis: 0 }"
            />
            <div
              class="h-full bg-progress transition-all duration-500"
              :style="{ flexGrow: d.inProgress, flexBasis: 0 }"
            />
            <div
              class="h-full bg-brand-2 transition-all duration-500"
              :style="{ flexGrow: d.needsPractice, flexBasis: 0 }"
            />
            <div
              class="h-full bg-text-3 opacity-25 transition-all duration-500"
              :style="{ flexGrow: d.unexplored, flexBasis: 0 }"
            />
          </div>
        </li>
      </ul>
    </div>

    <!-- Knowledge tree -->
    <div class="border-t border-(--color-divider) p-6">
      <p class="text-xs text-text-3 mb-3">{{ t('topic.knowledgeTree') }}</p>
      <MasteryTree :domains="state.domains" />
    </div>

    <!-- Activity strip -->
    <div
      class="border-t border-(--color-divider) grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-(--color-divider)"
    >
      <div class="p-5">
        <p class="text-xs text-text-3 mb-1.5">{{ t('dashboard.overview.activity') }}</p>
        <p class="text-sm text-text-2">
          <span class="font-semibold tabular-nums text-text-1">{{ stats.totalPractice }}</span>
          {{ t('dashboard.overview.practices') }}
          <span class="text-text-3 mx-1">·</span>
          <span class="font-semibold tabular-nums text-text-1">{{ stats.totalExplain }}</span>
          {{ t('dashboard.overview.explains') }}
        </p>
      </div>
      <div class="p-5">
        <p class="text-xs text-text-3 mb-1.5">{{ t('dashboard.overview.content') }}</p>
        <p class="text-sm text-text-2">
          <span class="font-semibold tabular-nums text-text-1">{{ state.domains.length }}</span>
          {{ t('topic.domains') }}
          <span class="text-text-3 mx-1">·</span>
          <span class="font-semibold tabular-nums text-text-1">{{ stats.totalConcepts }}</span>
          {{ t('topic.concepts') }}
        </p>
      </div>
      <div class="p-5">
        <p class="text-xs text-text-3 mb-1.5">{{ t('dashboard.overview.recent') }}</p>
        <p class="text-sm text-text-2">
          <template v-if="stats.lastActivityDays !== null">
            <span class="font-semibold tabular-nums text-text-1">{{ stats.lastActivityDays }}</span
            >{{ t('review.daysAgo') }}
          </template>
          <span v-else class="text-text-3">{{ t('review.never') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
