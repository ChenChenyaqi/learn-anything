<script setup lang="ts">
// Application shell — thin orchestrator.
//
// Owns the cross-phase orchestration (working-folder flow + app-session boot),
// then routes between the loading / setup / main phases. Each phase's content
// lives in its own component; this file is just wiring + the phase switch.
// The system light/dark theme is followed via `useDarkMode` (mirrors the site).

import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import SetupScreen from './components/SetupScreen.vue';
import MainView from './components/MainView.vue';
import { useDarkMode } from './composables/useDarkMode';
import { useLanguage } from './composables/useLanguage';
import { useWorkingFolder } from './composables/useWorkingFolder';
import { useAppSession } from './composables/useAppSession';
import { btnGhost } from './lib/ui';

useDarkMode();

const { t } = useI18n();

const folder = useWorkingFolder();
const { project, projectError, folderBusy } = folder;
const session = useAppSession({ openFolder: folder.openFolder });
const { view, config, keyPreview } = session;

// Language: follow the stored preference once config loads, or the system
// languages live (see `useLanguage` for the full pipeline).
const { setLanguage } = useLanguage(config);

/** Pick + validate a folder, then refresh config so the header reflects it. */
async function chooseFolder() {
  const dir = await folder.chooseFolder();
  if (dir) await session.reloadConfig();
}

onMounted(session.boot);
</script>

<template>
  <main class="min-h-screen bg-(--color-page) text-(--color-ink)">
    <!-- Boot probe. -->
    <div v-if="view === 'loading'" class="grid min-h-screen place-items-center opacity-60">
      {{ t('app.starting') }}
    </div>

    <!-- Setup / Settings. -->
    <div v-else-if="view === 'setup'" class="relative">
      <button
        v-if="keyPreview !== null"
        type="button"
        :class="[btnGhost, 'absolute top-4 left-4 text-sm']"
        @click="view = 'main'"
      >
        ← {{ t('common.back') }}
      </button>
      <SetupScreen
        :config="config"
        :existing-key-preview="keyPreview"
        @saved="session.refreshAfterSave"
        @language="setLanguage"
      />
    </div>

    <MainView
      v-else
      :config="config"
      :project="project"
      :project-error="projectError"
      :folder-busy="folderBusy"
      @choose="chooseFolder"
      @settings="view = 'setup'"
    />
  </main>
</template>
