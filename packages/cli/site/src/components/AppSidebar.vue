<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '../composables/useI18n';
import type { SelectedFilePayload } from '../composables/useTopicData';
import SearchTrigger from './SearchTrigger.vue';
import SidebarMobileToggle from './sidebar/SidebarMobileToggle.vue';
import SidebarDashboard from './sidebar/SidebarDashboard.vue';
import SidebarTopicTree from './sidebar/SidebarTopicTree.vue';
import SidebarExerciseTree from './sidebar/SidebarExerciseTree.vue';
import SidebarFooter from './sidebar/SidebarFooter.vue';

const props = defineProps<{
  context: 'dashboard' | 'topic';
  topicSlug?: string;
  initialTab?: 'topics' | 'exercises';
  selectedFilePath?: string | null;
}>();

const emit = defineEmits<{
  'file-selected': [file: SelectedFilePayload | null];
  'topic-selected': [slug: string];
  'back-to-dashboard': [];
  'search-open': [];
}>();

const { t } = useI18n();

const mobileOpen = ref(false);
const tabMode = ref<'topics' | 'exercises'>('topics');

watch(
  () => props.initialTab,
  (tab) => {
    if (tab === 'exercises') tabMode.value = 'exercises';
  },
  { immediate: true },
);

function onMobileClose() {
  mobileOpen.value = false;
}

function onTopicSelected(slug: string) {
  emit('topic-selected', slug);
  mobileOpen.value = false;
}

function onFileSelected(payload: { path: string; type: 'markdown' | 'code' }) {
  emit('file-selected', { ...payload, sourceTab: tabMode.value });
  mobileOpen.value = false;
}

function onKnowledgeMap() {
  emit('file-selected', null);
}

function switchTab(tab: 'topics' | 'exercises') {
  tabMode.value = tab;
}
</script>

<template>
  <SidebarMobileToggle
    :mobile-open="mobileOpen"
    @toggle="mobileOpen = !mobileOpen"
    @close="onMobileClose"
  />

  <aside
    class="fixed top-0 left-0 bottom-0 z-40 w-68 bg-(--color-bg-alt) flex flex-col transition-transform duration-200 lg:translate-x-0"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="px-6 pt-6 pb-4">
      <button
        class="text-base font-semibold text-text-1 hover:text-brand-2 transition-colors cursor-pointer"
        @click="emit('back-to-dashboard')"
      >
        Learn Anything
      </button>
    </div>

    <div class="px-6 pb-3">
      <SearchTrigger @open="emit('search-open')" />
    </div>

    <div class="mx-6 border-t border-(--color-divider)" />

    <!-- Dashboard: topic list -->
    <SidebarDashboard v-if="context === 'dashboard'" @topic-selected="onTopicSelected" />

    <!-- Topic mode: tabs + trees -->
    <template v-else>
      <div class="px-6 pt-3">
        <div class="flex gap-6">
          <button
            class="pb-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px"
            :class="
              tabMode === 'topics'
                ? 'border-brand-2 text-brand-2'
                : 'border-transparent text-text-2 hover:text-text-1'
            "
            @click="switchTab('topics')"
          >
            {{ t('sidebar.topics') }}
          </button>
          <button
            class="pb-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px"
            :class="
              tabMode === 'exercises'
                ? 'border-brand-2 text-brand-2'
                : 'border-transparent text-text-2 hover:text-text-1'
            "
            @click="switchTab('exercises')"
          >
            {{ t('sidebar.exercises') }}
          </button>
        </div>
      </div>

      <div class="mx-6 border-t border-(--color-divider)" />

      <SidebarTopicTree
        v-if="tabMode === 'topics' && topicSlug"
        :topic-slug="topicSlug"
        :selected-file-path="selectedFilePath"
        @file-selected="onFileSelected"
        @knowledge-map="onKnowledgeMap"
      />

      <SidebarExerciseTree
        v-if="tabMode === 'exercises' && topicSlug"
        :topic-slug="topicSlug"
        :selected-file-path="selectedFilePath"
        @file-selected="onFileSelected"
      />
    </template>

    <SidebarFooter />
  </aside>
</template>
