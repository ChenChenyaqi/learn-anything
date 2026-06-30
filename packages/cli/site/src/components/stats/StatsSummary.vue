<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';
import type { DashboardStats } from './useDashboardStats';

defineProps<{ stats: DashboardStats }>();

const { t } = useI18n();
</script>

<template>
  <div
    class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-(--color-divider)"
  >
    <!-- Activity -->
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
    <!-- Content -->
    <div class="p-5">
      <p class="text-xs text-text-3 mb-1.5">{{ t('dashboard.overview.content') }}</p>
      <p class="text-sm text-text-2">
        <span class="font-semibold tabular-nums text-text-1">{{ stats.noteCount }}</span>
        {{ t('domain.notes') }}
        <span class="text-text-3 mx-1">·</span>
        <span class="font-semibold tabular-nums text-text-1">{{ stats.exerciseCount }}</span>
        {{ t('domain.exercises') }}
        <span class="text-text-3 mx-1">·</span>
        <span class="font-semibold tabular-nums text-text-1">{{ stats.domainCount }}</span>
        {{ t('topic.domains') }}
      </p>
    </div>
    <!-- Recent -->
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
</template>
