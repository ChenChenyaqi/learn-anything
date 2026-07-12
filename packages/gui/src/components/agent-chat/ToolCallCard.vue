<script setup lang="ts">
// Notebook-margin tool-call card.
//
// Renders every built-in tool (bash / read / write / edit / grep / find / ls)
// as a CLI-style one-liner — the tool name and its arguments are merged into
// a single summary.  Large payloads (write content, edit diffs, long bash
// commands) are shown in a clamped ExpandableCode block.  Unknown tools fall
// back to "name + JSON args".  The tool result is always behind a collapsible
// <details>.  No inner scrollbars; the page is the only scroll container.

import { computed, ref } from 'vue';
import { toolCard } from '@/lib/ui';
import { summarizeToolCall } from './tool-display';
import ExpandableCode from './ExpandableCode.vue';

const props = defineProps<{
  status: string;
  name: string;
  args: unknown;
  result: string | null;
}>();

const display = computed(() => summarizeToolCall(props.name, props.args));

const indicatorClass = computed(() => {
  if (props.status === 'running') return 'indicator-running';
  if (props.status === 'ok') return 'indicator-ok';
  return 'indicator-error';
});

const resultOpen = ref(false);
</script>

<template>
  <div :class="[toolCard, 'py-1.5']">
    <!-- header: dot + CLI summary (tool name and args fused) -->
    <div class="flex items-center gap-2">
      <span :class="['indicator', indicatorClass]"></span>
      <span class="font-mono text-xs text-(--color-pencil)">{{ display.summary }}</span>
    </div>

    <!-- body: large payload (write content, edit diffs, long bash, unknown JSON) -->
    <ExpandableCode v-if="display.body" class="mt-2" :content="display.body.content" />

    <!-- result: collapsible, lazy-rendered -->
    <details
      v-if="status !== 'running' && result"
      class="mt-2"
      @toggle="resultOpen = ($event.target as HTMLDetailsElement).open"
    >
      <summary
        class="result-toggle flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs text-(--color-pencil) transition-colors hover:bg-(--color-surface-hover) hover:text-(--color-ink) [&::-webkit-details-marker]:hidden"
      >
        <span class="disclosure-tri" aria-hidden="true">▸</span>
        <span>result</span>
      </summary>
      <ExpandableCode v-if="resultOpen" class="mt-2" :content="result" />
    </details>
  </div>
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

.disclosure-tri {
  display: inline-block;
  font-size: 0.625rem;
  transition: transform 0.15s ease;
}

details[open] .disclosure-tri {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .indicator-running {
    animation: none;
  }
}
</style>
