<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '../composables/useI18n';
import type { SearchEntry } from '../composables/useSearch';
import { breadcrumb, resolveNavKey, useSearchModal } from '../composables/useSearchModal';

/* ------------------------------------------------------------------ */
/*  Props / Emits                                                      */
/* ------------------------------------------------------------------ */

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  select: [entry: SearchEntry];
}>();

const { t } = useI18n();

/* ------------------------------------------------------------------ */
/*  Search modal state (delegated to composable)                       */
/* ------------------------------------------------------------------ */

const {
  query,
  activeIndex,
  loadingError,
  hasQuery,
  hasResults,
  groups,
  activeEntry,
  ensureIndex,
  runSearch,
  reset,
  moveActive,
  setActive,
} = useSearchModal();

/* ------------------------------------------------------------------ */
/*  Lifecycle — react to open/close                                    */
/* ------------------------------------------------------------------ */

const inputEl = ref<HTMLInputElement | null>(null);
const listEl = ref<HTMLElement | null>(null);
let savedFocus: HTMLElement | null = null;

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    reset();
    await ensureIndex();
    await nextTick();
    inputEl.value?.focus();
  },
  { immediate: true },
);

function close() {
  emit('close');
}

/** Restore focus to whatever had it before the modal opened. */
watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      savedFocus = document.activeElement as HTMLElement | null;
    }
    if (!isOpen && wasOpen && savedFocus) {
      nextTick(() => savedFocus?.focus());
    }
  },
);

/* ------------------------------------------------------------------ */
/*  Keyboard navigation                                                */
/* ------------------------------------------------------------------ */

function onKeydown(e: KeyboardEvent) {
  const action = resolveNavKey(e.key);
  if (!action) return;
  e.preventDefault();

  switch (action.type) {
    case 'move':
      moveActive(action.delta);
      scrollActiveIntoView();
      break;
    case 'select':
      if (activeEntry.value) emit('select', activeEntry.value);
      break;
    case 'close':
      close();
      break;
    case 'trap':
      break;
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listEl.value?.querySelector<HTMLElement>(`[data-idx="${activeIndex.value}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  });
}

function select(entry: SearchEntry) {
  emit('select', entry);
}

/* ------------------------------------------------------------------ */
/*  Body scroll lock while modal is open                               */
/* ------------------------------------------------------------------ */

watch(
  () => props.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },
);

onBeforeUnmount(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-100 flex items-start justify-center px-4 pt-[12vh]"
      @mousedown.self="close"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />

      <!-- Dialog -->
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="t('search.open')"
        class="relative w-full max-w-xl overflow-hidden rounded-xl border border-(--color-divider) bg-(--color-bg-elv) shadow-2xl"
        @keydown="onKeydown"
      >
        <!-- Input -->
        <div class="h-16 flex items-center gap-3 border-b border-(--color-divider) px-4">
          <svg
            class="h-5 w-5 shrink-0 text-text-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            class="h-1/2 flex-1 bg-transparent py-3.5 text-base text-text-1 placeholder-text-3 outline-none rounded-sm"
            :placeholder="t('search.placeholder')"
            @input="runSearch"
          />
          <kbd
            class="shrink-0 rounded border border-(--color-divider) px-1.5 py-0.5 font-mono text-xs text-text-3"
          >
            esc
          </kbd>
        </div>

        <!-- Results -->
        <div ref="listEl" class="max-h-[50vh] overflow-y-auto p-2">
          <!-- Error state -->
          <p v-if="loadingError" class="px-3 py-6 text-center text-sm text-text-2">
            {{ t('search.noResults') }}
          </p>

          <!-- No query yet -->
          <p v-else-if="!hasQuery" class="px-3 py-6 text-center text-sm text-text-3">
            {{ t('search.placeholder') }}
          </p>

          <!-- No results -->
          <p v-else-if="!hasResults" class="px-3 py-6 text-center text-sm text-text-2">
            {{ t('search.noResults') }}
          </p>

          <!-- Grouped results -->
          <template v-else>
            <div v-for="group in groups" :key="group.key" class="mb-1">
              <!-- Group header -->
              <div class="truncate px-3 py-1 text-xs font-medium text-text-3">
                {{ group.label }}
              </div>

              <!-- Result items -->
              <button
                v-for="(entry, i) in group.entries"
                :key="`${group.key}-${entry.title}-${entry.level}`"
                :data-idx="group.startIndex + i"
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                :class="
                  activeIndex === group.startIndex + i
                    ? 'bg-brand-soft text-text-1'
                    : 'text-text-2 hover:bg-(--color-bg-soft)'
                "
                @click="select(entry)"
                @mousemove="setActive(group.startIndex + i)"
              >
                <!-- Active accent bar -->
                <span
                  class="-ml-3 w-0.5 self-stretch rounded-full transition-colors"
                  :class="activeIndex === group.startIndex + i ? 'bg-brand-2' : 'bg-transparent'"
                />
                <span
                  class="flex-1 truncate text-sm"
                  :class="entry.level === 0 ? 'font-medium' : ''"
                >
                  {{ entry.title }}
                </span>
                <span class="shrink-0 truncate font-mono text-xs text-text-3">
                  {{ breadcrumb(entry) }}
                </span>
              </button>
            </div>
          </template>
        </div>

        <!-- Footer hint -->
        <div
          class="flex items-center gap-4 border-t border-(--color-divider) px-4 py-2 text-xs text-text-3"
        >
          <span><kbd class="font-mono">↑↓</kbd> navigate</span>
          <span><kbd class="font-mono">↵</kbd> open</span>
          <span><kbd class="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
