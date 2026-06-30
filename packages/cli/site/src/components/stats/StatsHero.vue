<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import type { MasteryStats } from './useDashboardStats';

defineProps<{ stats: MasteryStats }>();

const { t } = useI18n();
</script>

<template>
  <div class="p-6">
    <!-- Editorial sentence: big numbers woven into prose -->
    <p class="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-4 text-sm text-text-2">
      <span>{{ t('status.mastered') }}</span>
      <span class="text-2xl font-bold tabular-nums text-text-1 leading-none">{{
        stats.mastered
      }}</span>
      <span class="text-text-3">/</span>
      <span class="text-lg font-semibold tabular-nums text-text-3 leading-none">
        {{ stats.totalConcepts }}
      </span>
      <span>{{ t('topic.concepts') }}</span>
      <span class="text-text-3 mx-0.5">·</span>
      <span class="text-2xl font-bold tabular-nums text-mastered leading-none"
        >{{ stats.overallPct }}%</span
      >
    </p>

    <!-- Segmented ledger rule: proportional by concept status -->
    <div class="flex h-2.5 w-full rounded-full overflow-hidden bg-(--color-divider)">
      <div
        class="h-full bg-mastered transition-all duration-500"
        :style="{ flexGrow: stats.mastered, flexBasis: 0 }"
      />
      <div
        class="h-full bg-progress transition-all duration-500"
        :style="{ flexGrow: stats.inProgress, flexBasis: 0 }"
      />
      <div
        class="h-full bg-brand-2 transition-all duration-500"
        :style="{ flexGrow: stats.needsPractice, flexBasis: 0 }"
      />
      <div
        class="h-full bg-text-3 opacity-25 transition-all duration-500"
        :style="{ flexGrow: stats.unexplored, flexBasis: 0 }"
      />
    </div>

    <!-- Tick labels -->
    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-3">
      <span class="inline-flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-mastered" />
        <span class="font-semibold tabular-nums text-text-2">{{ stats.mastered }}</span>
        {{ t('status.mastered') }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-progress" />
        <span class="font-semibold tabular-nums text-text-2">{{ stats.inProgress }}</span>
        {{ t('status.inProgress') }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-brand-2" />
        <span class="font-semibold tabular-nums text-text-2">{{ stats.needsPractice }}</span>
        {{ t('status.needsPractice') }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-text-3 opacity-25" />
        <span class="font-semibold tabular-nums text-text-2">{{ stats.unexplored }}</span>
        {{ t('status.unexplored') }}
      </span>
    </div>
  </div>
</template>
