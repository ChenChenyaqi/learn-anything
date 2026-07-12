<script setup lang="ts">
// A code/text block that clamps long content to ~N visible lines, fades the
// bottom edge, and expands inline on demand. It never scrolls on its own
// (overflow: hidden) — expanding reveals the full content in the page flow, so
// the page stays the only scroll container. Used by ToolCallCard for both tool
// arguments and results.

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{ content: string; lines?: number }>(), {
  lines: 12,
});

const collapsedHeight = computed(() => `calc(${props.lines} * 1.4rem)`);

const preEl = ref<HTMLPreElement | null>(null);
const expanded = ref(false);
const overflows = ref(false);

function measure(): void {
  const node = preEl.value;
  if (!node) return;
  // scrollHeight is the full natural height; clientHeight is the clamped
  // height (because max-height is applied while collapsed). The clamp is
  // always applied when collapsed so this works even before the first toggle.
  overflows.value = node.scrollHeight - node.clientHeight > 1;
}

let observer: ResizeObserver | null = null;
onMounted(() => {
  measure();
  observer = new ResizeObserver(() => {
    // Width changes (reflow) change line wrapping and thus overflow state.
    if (!expanded.value) measure();
  });
  if (preEl.value) observer.observe(preEl.value);
});

onBeforeUnmount(() => observer?.disconnect());

watch(
  () => props.content,
  () => nextTick(measure),
);
watch(expanded, (open) => {
  if (!open) nextTick(measure);
});
</script>

<template>
  <div>
    <div class="relative rounded-sm bg-(--color-code-bg) p-2">
      <pre
        ref="preEl"
        class="m-0 whitespace-pre-wrap wrap-break-word font-mono text-xs text-(--color-ink)"
        :style="expanded ? undefined : { 'max-height': collapsedHeight, overflow: 'hidden' }"
        >{{ content }}</pre
      >
      <div
        v-if="!expanded && overflows"
        class="fade-overlay pointer-events-none absolute inset-x-0 bottom-0 h-7"
      ></div>
    </div>
    <button
      v-if="overflows"
      type="button"
      class="mt-1 cursor-pointer font-mono text-xs text-(--color-pencil) transition-colors hover:text-(--color-ink)"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'show less ↑' : 'show more ↓' }}
    </button>
  </div>
</template>

<style scoped>
.fade-overlay {
  background: linear-gradient(to bottom, transparent, var(--color-code-bg));
}
</style>
