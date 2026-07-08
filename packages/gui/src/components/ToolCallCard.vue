<script setup lang="ts">
// Notebook-margin tool-call card.
//
// Shows tool name in mono with a status-colored indicator dot. Collapsed while
// running (not clickable); becomes an expandable <details> once the result
// arrives. Expanded body shows args as pretty JSON on a code background and
// the result text capped to 12 visible lines with scroll.

import { computed } from 'vue';
import { toolCard } from '../lib/ui';

const props = defineProps<{
  status: string;
  name: string;
  args: unknown;
  result: string | null;
}>();

const argsJson = computed(() => {
  try {
    return JSON.stringify(props.args, null, 2);
  } catch {
    return String(props.args);
  }
});

const indicatorClass = computed(() => {
  if (props.status === 'running') return 'indicator-running';
  if (props.status === 'ok') return 'indicator-ok';
  return 'indicator-error';
});
</script>

<template>
  <!-- Running: collapsed, not clickable -->
  <div v-if="status === 'running'" :class="[toolCard, 'py-1.5']">
    <div class="flex items-center gap-2">
      <span :class="['indicator', indicatorClass]"></span>
      <span class="font-mono text-xs text-(--color-pencil)">{{ name }}</span>
    </div>
  </div>

  <!-- Completed: expandable -->
  <details v-else :class="[toolCard, 'group py-1.5']">
    <summary
      class="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"
    >
      <span :class="['indicator', indicatorClass]"></span>
      <span class="font-mono text-xs text-(--color-pencil)">{{ name }}</span>
    </summary>
    <div class="mt-2 flex flex-col gap-2">
      <div v-if="argsJson !== '{}'" class="overflow-x-auto rounded-[var(--radius-sm)] bg-(--color-code-bg) p-2">
        <pre class="m-0 whitespace-pre-wrap break-words font-mono text-xs text-(--color-ink)">{{ argsJson }}</pre>
      </div>
      <div v-if="result" class="max-h-60 overflow-y-auto rounded-[var(--radius-sm)] bg-(--color-code-bg) p-2">
        <pre class="result-pre m-0 whitespace-pre-wrap break-words font-mono text-xs text-(--color-ink)">{{ result }}</pre>
      </div>
    </div>
  </details>
</template>

<style scoped>
.indicator {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.indicator-running {
  background-color: var(--color-accent);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.indicator-ok {
  background-color: var(--color-mastered);
}

.indicator-error {
  background-color: var(--color-brand-1);
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

/* 12 visible lines of result text */
.result-pre {
  line-height: 1.4rem;
  max-height: calc(12 * 1.4rem);
}

@media (prefers-reduced-motion: reduce) {
  .indicator-running {
    animation: none;
  }
}
</style>
