<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from '../../composables/useI18n';
import {
  loadTopic,
  scanSessions,
  scanRootSessions,
  loadFileContent,
} from '../../composables/useTopicData';
import type { Domain, SessionFile } from '../../composables/useTopicData';

const props = defineProps<{
  topicSlug: string;
}>();

const emit = defineEmits<{
  'file-selected': [file: { path: string; content: string; type: 'markdown' }];
  'knowledge-map': [];
}>();

const { t } = useI18n();

const expandedDomains = ref<Set<string>>(new Set());

interface DomainWithSessions {
  domain: Domain;
  sessions: SessionFile[];
}

const currentState = computed(() => loadTopic(props.topicSlug));

const domainSessions = computed<DomainWithSessions[]>(() => {
  if (!currentState.value) return [];
  return currentState.value.domains.map((domain) => ({
    domain,
    sessions: scanSessions(props.topicSlug, domain.slug),
  }));
});

const rootSessions = computed<SessionFile[]>(() => scanRootSessions(props.topicSlug));

watch(
  () => props.topicSlug,
  (slug) => {
    expandedDomains.value = new Set();
    const state = loadTopic(slug);
    if (state?.domains[0]) expandedDomains.value.add(state.domains[0].slug);
  },
  { immediate: true },
);

function toggleDomain(domainSlug: string) {
  const s = new Set(expandedDomains.value);
  if (s.has(domainSlug)) s.delete(domainSlug);
  else s.add(domainSlug);
  expandedDomains.value = s;
}

async function selectSessionFile(file: SessionFile) {
  const content = await loadFileContent(file.path);
  if (content !== null) {
    emit('file-selected', { path: file.path, content, type: 'markdown' });
  }
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
          @click="toggleDomain(ds.domain.slug)"
        >
          <span
            class="text-[10px] transition-transform duration-150 shrink-0 w-3 text-center"
            :class="expandedDomains.has(ds.domain.slug) ? 'rotate-90' : ''"
          >▶</span>
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
