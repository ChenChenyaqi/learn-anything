<script setup lang="ts">
import { useReviewItems, type ReviewReason, type ReviewItem } from './useReview';
import { useI18n, type I18nKey } from '@/composables/useI18n';
import { useRouter } from 'vue-router';

const router = useRouter();
const { t } = useI18n();
const items = useReviewItems(8);

const REASON_BORDER: Record<ReviewReason, string> = {
  never_practiced: 'var(--color-brand-2)',
  needs_practice: 'var(--color-brand-3)',
  low_confidence: 'var(--color-progress)',
  stale: 'var(--color-text-3)',
};

const REASON_TEXT: Record<ReviewReason, string> = {
  never_practiced: 'var(--color-brand-2)',
  needs_practice: 'var(--color-brand-3)',
  low_confidence: 'var(--color-progress)',
  stale: 'var(--color-text-2)',
};

const REASON_KEYS: Record<ReviewReason, I18nKey> = {
  never_practiced: 'review.neverPracticed',
  needs_practice: 'review.needsPractice',
  low_confidence: 'review.lowConfidence',
  stale: 'review.stale',
};

const NEVER_SENTINEL = 365;

function formatTime(item: ReviewItem): string {
  if (item.daysSinceActivity >= NEVER_SENTINEL) return t('review.never');
  return `${item.daysSinceActivity}${t('review.daysAgo')}`;
}

function goToTopic(slug: string): void {
  router.push(`/topics/${slug}`);
}
</script>

<template>
  <div
    v-if="items.length > 0"
    class="bg-(--color-bg-soft) rounded-xl border border-(--color-divider) shadow-sm overflow-hidden lg:h-[400px] lg:flex lg:flex-col"
  >
    <!-- Header -->
    <div class="flex items-baseline justify-between px-5 py-3 shrink-0">
      <h3 class="text-sm font-semibold text-text-1">{{ t('review.title') }}</h3>
      <span class="text-xs text-text-3 tabular-nums">{{ items.length }}</span>
    </div>

    <!-- Items -->
    <div class="divide-y divide-(--color-divider) border-t border-(--color-divider) lg:flex-1 lg:overflow-y-auto">
      <button
        v-for="item in items"
        :key="item.topicSlug + '-' + item.conceptSlug"
        class="w-full flex items-center gap-3 pl-4 pr-5 py-2.5 text-left border-l-[3px] border-solid hover:bg-(--color-brand-soft) transition-all duration-150 cursor-pointer"
        :style="{ borderLeftColor: REASON_BORDER[item.reason] }"
        @click="goToTopic(item.topicSlug)"
      >
        <span class="flex-1 min-w-0 truncate text-sm font-medium text-text-1">
          {{ item.conceptName }}
        </span>
        <span class="shrink-0 flex items-center gap-1.5 text-xs text-text-3 ml-3">
          <span class="font-medium" :style="{ color: REASON_TEXT[item.reason] }">{{ t(REASON_KEYS[item.reason]) }}</span>
          <span class="opacity-40">·</span>
          <span class="tabular-nums">{{ formatTime(item) }}</span>
          <span class="opacity-40 hidden sm:inline">·</span>
          <span class="hidden sm:inline">{{ item.topicName }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
