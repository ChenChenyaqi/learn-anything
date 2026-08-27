<script setup lang="ts">
// Stateless slash-command popover.
//
// Renders a filtered list of commands with a highlighted row. The parent owns
// the keyboard (↑↓ Enter Esc on the textarea) and passes the current highlight
// `index` + filtered `commands`. Row clicks emit `select`.

import { useI18n } from 'vue-i18n';
import type { SlashCommand } from './slash-commands';

const { t } = useI18n();

defineProps<{
  commands: SlashCommand[];
  query: string;
  index: number;
}>();

const emit = defineEmits<{
  select: [index: number];
  close: [];
  move: [direction: 1 | -1];
}>();
</script>

<template>
  <div
    v-if="commands.length > 0"
    class="slash-menu mb-1 overflow-hidden rounded-(--radius-card) border border-(--color-rule) bg-(--color-bg-elv) text-sm shadow-sm"
  >
    <button
      v-for="(cmd, i) in commands"
      :key="cmd.name"
      type="button"
      :class="[
        'flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left transition-colors',
        i === index ? 'border-(--color-accent) bg-(--color-accent-soft)' : 'border-transparent',
      ]"
      @click="emit('select', i)"
    >
      <span class="font-mono text-(--color-ink)">/{{ cmd.name }}</span>
      <span v-if="cmd.argumentHint" class="font-mono text-xs text-(--color-pencil)">{{ cmd.argumentHint }}</span>
      <span class="text-(--color-pencil)">{{ t(`chat.cmd.${cmd.description}`) }}</span>
    </button>
  </div>
</template>

<style scoped>
.slash-menu {
  animation: slash-fade-in 80ms ease-out;
}

@keyframes slash-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .slash-menu {
    animation: none;
  }
}
</style>
