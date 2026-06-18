<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import { listAllTopics, getDataVersion } from '../../composables/useTopicData';

defineEmits<{
  'topic-selected': [slug: string];
}>();

const { t } = useI18n();
const topics = computed(() => {
  void getDataVersion();
  return listAllTopics();
});
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-4">
    <p
      v-if="topics.length > 0"
      class="text-xs font-semibold text-text-2 uppercase tracking-wide mb-2"
    >
      Topics
    </p>

    <div class="space-y-0.5">
      <button
        v-for="topic in topics"
        :key="topic.slug"
        class="w-full text-left px-3 py-1.5 rounded-md text-sm font-medium text-text-2 hover:text-text-1 transition-colors cursor-pointer"
        @click="$emit('topic-selected', topic.slug)"
      >
        <span class="block">{{ topic.name }}</span>
        <span class="block text-xs mt-0.5 font-normal text-text-3">
          {{ topic.masteredCount }}/{{ topic.totalConcepts }} mastered
        </span>
      </button>
    </div>

    <div v-if="topics.length === 0" class="text-xs text-text-2 mt-2">
      {{ t('dashboard.noTopics') }}
    </div>
  </nav>
</template>
