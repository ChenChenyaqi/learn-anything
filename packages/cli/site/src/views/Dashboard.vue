<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { listAllTopics } from '@/composables/useTopicData';
import { useDashboardStats } from '@/components/stats/useDashboardStats';
import StatsHero from '@/components/stats/StatsHero.vue';
import StatsSummary from '@/components/stats/StatsSummary.vue';
import ReviewPanel from '@/components/review/ReviewPanel.vue';
import { useReviewItems } from '@/components/review/useReview';

const router = useRouter();
const { t } = useI18n();
const topics = computed(() => listAllTopics());
const reviewItems = useReviewItems(8);
const stats = useDashboardStats();

function goToTopic(slug: string) {
  router.push(`/topics/${slug}`);
}
</script>

<template>
  <div class="w-full pr-0 lg:pr-8 xl:pr-12 2xl:pr-16">
    <!-- Header — VitePress-style page heading with brand accent -->
    <div class="flex items-center gap-3 mb-4">
      <span class="w-1 h-6 rounded-full bg-brand-2 shrink-0" />
      <h1>
        {{ t('dashboard.title') }}
      </h1>
    </div>
    <p v-if="topics.length > 0" class="text-sm text-text-3 mb-10">
      {{ topics.length }} {{ topics.length === 1 ? 'topic' : 'topics' }}
    </p>

    <!-- Empty state -->
    <div
      v-if="topics.length === 0"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <p class="text-sm font-medium text-text-2 mb-2">
        {{ t('dashboard.noTopics') }}
      </p>
      <p class="text-xs text-text-3 max-w-md">
        {{ t('dashboard.startLearning') }}
      </p>
    </div>

    <!-- Content (only when topics exist) -->
    <template v-else>
      <!-- Topics band (top, full width) -->
      <section class="mb-8">
        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          <button
            v-for="topic in topics"
            :key="topic.slug"
            class="text-left bg-(--color-bg-soft) rounded-xl border border-(--color-divider) p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-brand-2 transition-all duration-200 cursor-pointer"
            @click="goToTopic(topic.slug)"
          >
            <!-- Title -->
            <h3 class="text-base font-semibold text-text-1 leading-snug mb-3">
              {{ topic.name }}
            </h3>

            <!-- Stats -->
            <p class="text-[13px] text-text-2 leading-relaxed">
              {{ topic.domainCount }} {{ t('topic.domains') }} · {{ topic.totalConcepts }}
              {{ t('topic.concepts') }} · {{ topic.masteredCount }}/{{ topic.totalConcepts }}
              {{ t('topic.mastered') }}
            </p>

            <!-- Progress bar — mastered-green, slightly thicker -->
            <div class="mt-4 flex items-center gap-3">
              <div class="flex-1 h-1.5 bg-(--color-divider) rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full bg-mastered transition-all duration-500"
                  :style="{ width: `${topic.percentage}%` }"
                />
              </div>
              <span class="text-xs font-semibold tabular-nums text-mastered">
                {{ topic.percentage }}%
              </span>
            </div>
          </button>
        </div>
      </section>

      <!-- Bottom: stats (left, grows) + review (right, fixed width) -->
      <div class="flex flex-col lg:flex-row gap-8 lg:gap-10">
        <!-- Left: merged stats card -->
        <div class="flex-1 min-w-0">
          <div
            class="bg-(--color-bg-soft) rounded-xl border border-(--color-divider) shadow-sm overflow-hidden"
          >
            <StatsHero :stats="stats" />
            <div class="border-t border-(--color-divider)">
              <StatsSummary :stats="stats" />
            </div>
          </div>
        </div>

        <!-- Right: Review panel (no longer sticky) -->
        <aside v-if="reviewItems.length > 0" class="w-full lg:w-72 xl:w-96 2xl:w-xl shrink-0">
          <ReviewPanel />
        </aside>
      </div>
    </template>
  </div>
</template>
