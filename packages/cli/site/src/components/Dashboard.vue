<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { listAllTopics } from '@/composables/useTopicData';

const router = useRouter();
const { t } = useI18n();
const topics = computed(() => listAllTopics());

function goToTopic(slug: string) {
  router.push(`/topics/${slug}`);
}
</script>

<template>
  <div class="w-full">
    <!-- Header — VitePress-style page heading -->
    <h1 class="mb-4">
      {{ t('dashboard.title') }}
    </h1>
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

    <!-- Topic cards — elastic grid, fixed card size, fills available width -->
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      <button
        v-for="topic in topics"
        :key="topic.slug"
        class="text-left bg-(--color-bg-soft) rounded-xl border border-(--color-divider) p-6 hover:border-brand-2 transition-colors duration-150 cursor-pointer"
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

        <!-- Progress bar — thin, VitePress style -->
        <div class="mt-4 flex items-center gap-3">
          <div class="flex-1 h-1 bg-(--color-divider) rounded-full overflow-hidden">
            <div
              class="h-full rounded-full bg-brand-2 transition-all duration-500"
              :style="{ width: `${topic.percentage}%` }"
            />
          </div>
          <span class="text-xs font-semibold tabular-nums text-text-2">
            {{ topic.percentage }}%
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
