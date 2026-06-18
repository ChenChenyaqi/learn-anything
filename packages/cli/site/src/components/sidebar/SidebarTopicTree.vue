<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from '../../composables/useI18n';
import { useTreeExpansion } from '../../composables/useTreeExpansion';
import {
  loadTopic,
  scanSessions,
  scanDomainDirs,
  scanRootSessions,
  getDataVersion,
} from '../../composables/useTopicData';
import type { Domain, SessionFile } from '../../composables/useTopicData';

const props = defineProps<{
  topicSlug: string;
  selectedFilePath?: string | null;
}>();

const emit = defineEmits<{
  'file-selected': [file: { path: string; type: 'markdown' }];
  'knowledge-map': [];
}>();

const { t } = useI18n();

const {
  expanded: expandedDomains,
  load: loadExpansion,
  toggle: toggleExpansion,
  add: addExpansion,
} = useTreeExpansion('topics');

interface DomainWithSessions {
  domain: Domain;
  sessions: SessionFile[];
  isOrphan: boolean;
}

const currentState = computed(() => {
  void getDataVersion();
  return loadTopic(props.topicSlug);
});

/* Mirror the actual sessions/ folders. state.json only supplies the display
   name and ordering; folders absent from state.json are shown as orphans. */
const domainSessions = computed<DomainWithSessions[]>(() => {
  void getDataVersion();
  const state = currentState.value;
  const dirSlugs = scanDomainDirs(props.topicSlug);
  if (dirSlugs.length === 0) return [];

  const domainMap = new Map((state?.domains ?? []).map((d) => [d.slug, d]));
  const orderMap = new Map((state?.domains ?? []).map((d, i) => [d.slug, i]));

  return dirSlugs
    .map((slug) => {
      const domain = domainMap.get(slug);
      return {
        domain: domain ?? { name: slug, slug, concepts: [] },
        sessions: scanSessions(props.topicSlug, slug),
        isOrphan: !domain,
      };
    })
    .sort((a, b) => {
      const oa = orderMap.get(a.domain.slug) ?? Number.MAX_SAFE_INTEGER;
      const ob = orderMap.get(b.domain.slug) ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.domain.slug.localeCompare(b.domain.slug);
    });
});

const rootSessions = computed<SessionFile[]>(() => {
  void getDataVersion();
  return scanRootSessions(props.topicSlug);
});

/* Switching topic: restore its persisted expansion (default to first node). */
watch(
  () => props.topicSlug,
  (slug) => {
    if (!slug) {
      expandedDomains.value = new Set();
      return;
    }
    const first = domainSessions.value[0]?.domain.slug;
    loadExpansion(slug, first ? [first] : []);
  },
  { immediate: true },
);

/* Selecting a file: expand its parent folder (incl. orphans) without collapsing others. */
watch(
  () => props.selectedFilePath,
  (filePath) => {
    if (!filePath || !props.topicSlug) return;
    for (const dirSlug of scanDomainDirs(props.topicSlug)) {
      const sessions = scanSessions(props.topicSlug, dirSlug);
      if (sessions.some((s) => s.path === filePath)) {
        addExpansion(props.topicSlug, dirSlug);
        return;
      }
    }
  },
  { immediate: true },
);

function toggleDomain(domainSlug: string) {
  toggleExpansion(props.topicSlug, domainSlug);
}

function selectSessionFile(file: SessionFile) {
  emit('file-selected', { path: file.path, type: 'markdown' });
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto px-6 py-3">
    <button
      class="w-full text-left text-sm font-semibold text-brand-2 hover:text-brand-1 transition-colors cursor-pointer mb-3"
      @click="$emit('knowledge-map')"
    >
      {{ currentState?.topic || topicSlug }}
    </button>

    <div v-if="domainSessions.length > 0" class="space-y-px">
      <div v-for="ds in domainSessions" :key="ds.domain.slug">
        <button
          class="w-full flex items-center gap-1.5 py-1 text-sm font-medium transition-colors cursor-pointer"
          :class="
            expandedDomains.has(ds.domain.slug)
              ? 'text-text-1'
              : 'text-text-2 hover:text-text-1'
          "
          :title="ds.isOrphan ? t('sidebar.orphanTip') : undefined"
          @click="toggleDomain(ds.domain.slug)"
        >
          <span
            class="text-[10px] transition-transform duration-150 shrink-0 w-3 text-center"
            :class="expandedDomains.has(ds.domain.slug) ? 'rotate-90' : ''"
          >▶</span>
          <span
            v-if="ds.isOrphan"
            class="inline-block w-[5px] h-[5px] rounded-full bg-text-3 shrink-0"
            aria-hidden="true"
          ></span>
          <span class="truncate">{{ ds.domain.name }}</span>
        </button>

        <div v-if="expandedDomains.has(ds.domain.slug)" class="pl-4 mb-1 space-y-px">
          <div v-if="ds.sessions.length === 0" class="py-1 text-[11px] text-text-3">
            {{ t('sidebar.noNotes') }}
          </div>
          <button
            v-for="file in ds.sessions"
            :key="file.path"
            class="block w-full text-left py-1 text-xs text-text-2 hover:text-text-1 transition-colors cursor-pointer truncate font-medium"
            @click="selectSessionFile(file)"
          >
            {{ file.filename }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="rootSessions.length > 0" class="pt-2 mb-1 space-y-px">
      <button
        v-for="file in rootSessions"
        :key="file.path"
        class="block w-full text-left py-1 text-xs text-text-2 hover:text-text-1 transition-colors cursor-pointer truncate font-medium"
        @click="selectSessionFile(file)"
      >
        {{ file.filename }}
      </button>
    </div>

    <div v-if="domainSessions.length === 0 && rootSessions.length === 0" class="py-2 text-xs text-text-3">
      {{ t('sidebar.noNotes') }}
    </div>
  </nav>
</template>
