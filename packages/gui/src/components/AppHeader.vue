<script setup lang="ts">
// Top bar of the main view: brand, current working-folder path, the
// folder pick/change button, and the Settings entry. Stateless — all actions
// bubble up as events; the parent owns the folder flow.
import { type AppConfig, type ProjectInfo } from '../lib/commands';
import { useI18n } from 'vue-i18n';
import { btnSecondary, btnGhost } from '../lib/ui';

const { t } = useI18n();

defineProps<{
  config: AppConfig | null;
  project: ProjectInfo | null;
  folderBusy: boolean;
}>();

const emit = defineEmits<{
  choose: [];
  settings: [];
}>();
</script>

<template>
  <header class="flex items-center gap-4 border-b border-(--color-rule) px-5 py-3">
    <span class="text-base font-semibold">Learn Anything</span>
    <div class="ml-auto flex items-center gap-2.5">
      <span
        v-if="config?.last_working_folder"
        class="max-w-88 truncate text-sm opacity-80"
        :title="config.last_working_folder"
      >
        {{ config.last_working_folder }}
      </span>
      <span v-else class="text-sm italic opacity-55">{{ t('header.noFolder') }}</span>
      <button
        type="button"
        :class="[btnSecondary, 'px-3 py-1.5 text-xs']"
        :disabled="folderBusy"
        @click="emit('choose')"
      >
        {{ folderBusy ? '…' : project ? t('header.change') : t('header.chooseFolder') }}
      </button>
    </div>
    <button type="button" :class="[btnGhost, 'px-3 py-1.5 text-xs']" @click="emit('settings')">
      {{ t('header.settings') }}
    </button>
  </header>
</template>
