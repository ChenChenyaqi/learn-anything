<script setup lang="ts">
// Sessions overlay — replaces the transcript area when open.
//
// Shows a back control, a search input, and a list of session rows. Row metadata
// is intentionally simplified to "<n> msgs · <Xh ago>". Filtering is by
// case-insensitive title substring.

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SessionMeta } from '@/lib/commands';
import { relativeTime } from '@/components/agent-chat/time';
import { btnGhost, fieldControl } from '@/lib/ui';

const { t } = useI18n();

const props = defineProps<{
  sessions: SessionMeta[];
}>();

const emit = defineEmits<{
  select: [id: string];
  back: [];
}>();

const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.sessions;
  return props.sessions.filter((s) => s.title.toLowerCase().includes(q));
});

function timeAgo(iso: string): string {
  const secs = Math.floor(Date.parse(iso) / 1000);
  if (Number.isNaN(secs)) return '';
  // Called from the template, so the `t` dependency re-renders the rows on a
  // locale switch.
  return relativeTime(secs, t);
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header: back + label -->
    <div class="flex items-center gap-3 pb-3">
      <button type="button" :class="[btnGhost, 'px-2 py-1 text-sm']" @click="emit('back')">
        ← {{ t('chat.back') }}
      </button>
      <span class="text-sm font-medium text-(--color-ink)">{{ t('chat.sessions') }}</span>
    </div>

    <!-- Search -->
    <input
      v-model="search"
      :class="[fieldControl, 'mb-3']"
      type="text"
      :placeholder="t('chat.searchPlaceholder')"
      autocomplete="off"
      spellcheck="false"
    />

    <!-- List -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden">
      <p v-if="filtered.length === 0" class="py-8 text-center text-sm text-(--color-pencil)">
        <i18n-t keypath="chat.emptySessions">
          <template #cmd><span class="font-mono">/new</span></template>
        </i18n-t>
      </p>
      <ul v-else class="flex flex-col">
        <li
          v-for="s in filtered"
          :key="s.id"
          :class="[
            'cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-(--color-surface-hover)',
          ]"
          @click="emit('select', s.id)"
        >
          <div class="text-sm font-medium text-(--color-ink)">{{ s.title }}</div>
          <div class="text-xs text-(--color-pencil)">
            {{ t('chat.msgCount', { count: s.message_count }) }} · {{ timeAgo(s.updated_at) }}
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
