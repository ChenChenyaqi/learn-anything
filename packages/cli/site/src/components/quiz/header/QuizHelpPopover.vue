<script setup lang="ts">
/* "?" help popover with its own open/close state and click-outside-to-close.
 * Fully self-contained — the parent just drops it in. */
import { ref, watch, onBeforeUnmount } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePlatform } from '@/composables/usePlatform';

const { t } = useI18n();
const { isMac } = usePlatform();

const showHelp = ref(false);

function closeHelp(): void {
  showHelp.value = false;
}

watch(showHelp, (on) => {
  if (on) document.addEventListener('click', closeHelp);
  else document.removeEventListener('click', closeHelp);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeHelp);
});
</script>

<template>
  <div class="relative">
    <button
      class="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-(--color-divider) text-xs text-text-3 transition-colors hover:border-brand-3 hover:text-brand-2"
      :aria-label="t('quiz.helpTitle')"
      @click.stop="showHelp = !showHelp"
    >
      ?
    </button>
    <div
      v-if="showHelp"
      class="absolute right-0 top-full z-20 mt-2 w-60 space-y-1.5 rounded-lg border border-(--color-divider) bg-(--color-bg-elv) p-3 shadow-xl"
      @click.stop
    >
      <p class="text-xs font-medium text-text-2">{{ t('quiz.helpTitle') }}</p>
      <p class="text-xs text-text-3">{{ t('quiz.hintChoice') }}</p>
      <p class="text-xs text-text-3">{{ t('quiz.hintTrueFalse') }}</p>
      <p class="text-xs text-text-3">{{ t('quiz.hintNav') }}</p>
      <p class="text-xs text-text-3">
        {{ t('quiz.hintSubmit').replace('{key}', isMac ? '⌘' : 'Ctrl') }}
      </p>
    </div>
  </div>
</template>
