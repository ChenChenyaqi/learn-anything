<script setup lang="ts">
// Overview landing view — the default route of the main phase.
//
// Renders the "Your learning" header (with an aggregate stat line + overall
// mastery bar), the topic list, and a footer hint. Data comes from
// `useTopicsOverview`, which live-reloads on `site://reload` and re-fetches when
// the working folder changes. States: loading / error (with retry) / empty /
// list.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TopicRow from './TopicRow.vue';
import { btnPrimary, btnSecondary, masteryBar, masteryBarFill } from '@/lib/ui';
import { useTopicsOverview } from './useTopicsOverview';

const props = defineProps<{
  workingFolder: string | null;
}>();

const { summaries, loading, error, overall, reload } = useTopicsOverview(() => props.workingFolder);

const { t } = useI18n();

const hasRows = computed(() => summaries.value.length > 0);

const subtitle = computed(() =>
  t('overview.subtitle', {
    topics: overall.value.topics,
    concepts: overall.value.totalConcepts,
    mastered: overall.value.mastered,
    percentage: overall.value.percentage,
  }),
);

/** Strip the site_api `"<code>|<message>"` prefix for display. */
const cleanError = computed(() => {
  const e = error.value;
  const idx = e.indexOf('|');
  return idx >= 0 ? e.slice(idx + 1) : e;
});

// Placeholder — the agent `/learn-topic` / create-topic flow lands in a later
// step. The button is rendered now to match the mockup but performs no action.
function newTopic() {}
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto pr-6">
    <!-- Header -->
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h1 class="m-0 text-2xl font-semibold tracking-tight">{{ t('overview.title') }}</h1>
        <p v-if="hasRows" class="mt-1.5 font-mono text-xs text-(--color-pencil)">
          {{ subtitle }}
        </p>
      </div>
      <button
        type="button"
        :class="[btnPrimary, 'gap-1.5 px-3.5 py-1.5 text-sm']"
        @click="newTopic"
      >
        <span class="text-base leading-none">+</span> {{ t('overview.newTopic') }}
      </button>
    </div>

    <!-- Initial load (no rows yet) -->
    <div v-if="loading && !hasRows" class="opacity-60">{{ t('common.loading') }}</div>

    <!-- Load error (no rows yet — a later reload may still recover) -->
    <div
      v-else-if="error && !hasRows"
      class="max-w-lg rounded-[10px] border border-(--color-accent) bg-(--color-accent-soft) p-4"
    >
      <p>{{ t('overview.loadError') }}</p>
      <pre class="my-2 whitespace-pre-wrap font-sans text-sm">{{ cleanError }}</pre>
      <button type="button" :class="[btnSecondary, 'px-3 py-1.5 text-xs']" @click="reload">
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Empty folder (or no folder yet) -->
    <p v-else-if="!hasRows" class="max-w-md text-sm text-(--color-pencil)">
      <i18n-t keypath="overview.emptyHint">
        <template #cmd><span class="font-mono text-(--color-ink)">/learn-topic</span></template>
      </i18n-t>
    </p>

    <!-- Topic list -->
    <template v-else>
      <div class="mb-8">
        <div :class="masteryBar">
          <i :class="masteryBarFill" :style="{ width: overall.percentage + '%' }" />
        </div>
      </div>

      <ul class="m-0 flex list-none flex-col p-0">
        <TopicRow v-for="(t, i) in summaries" :key="t.slug" :summary="t" :index="i" />
      </ul>

      <i18n-t keypath="overview.pickHint" tag="p" class="mt-10 max-w-md text-sm text-(--color-pencil)">
        <template #cmd><span class="font-mono text-(--color-ink)">/learn-topic</span></template>
      </i18n-t>
    </template>
  </div>
</template>
