<script setup lang="ts">
// Application shell — thin orchestrator.
//
// Composes `useWorkingFolder` (folder flow) with `useAppSession` (boot + view
// routing), then routes between the loading / setup / main views. All state
// and logic lives in the composables; this file is just wiring + markup.
// The system light/dark theme is followed via `useDarkMode` (mirrors the site).

import { onMounted } from 'vue';
import SetupScreen from './components/SetupScreen.vue';
import AppHeader from './components/AppHeader.vue';
import TopicList from './components/TopicList.vue';
import { useDarkMode } from './composables/useDarkMode';
import { useWorkingFolder } from './composables/useWorkingFolder';
import { useAppSession } from './composables/useAppSession';
import { btnGhost, btnPrimary, btnSecondary } from './lib/ui';

useDarkMode();

const folder = useWorkingFolder();
const { project, projectError, folderBusy } = folder;
const session = useAppSession({ openFolder: folder.openFolder });
const { view, config, keyPreview } = session;

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
      Starting…
    </div>

    <!-- Setup / Settings. -->
    <div v-else-if="view === 'setup'" class="relative">
      <button
        v-if="keyPreview !== null"
        type="button"
        :class="[btnGhost, 'absolute top-4 left-4 text-sm']"
        @click="view = 'main'"
      >
        ← Back
      </button>
      <SetupScreen
        :config="config"
        :existing-key-preview="keyPreview"
        @saved="session.refreshAfterSave"
      />
    </div>

    <!-- Main: folder + chat surface. -->
    <div v-else class="flex min-h-screen flex-col">
      <AppHeader
        :config="config"
        :project="project"
        :folder-busy="folderBusy"
        @choose="chooseFolder"
        @settings="view = 'setup'"
      />

      <section class="flex-1 p-6">
        <!-- Folder not yet chosen. -->
        <div
          v-if="!config?.last_working_folder && !projectError"
          class="flex flex-col items-center gap-4 pt-12 opacity-85"
        >
          <p>Pick a working folder to start creating topics.</p>
          <button type="button" :class="[btnPrimary, 'px-4 py-2']" @click="chooseFolder">
            Choose folder
          </button>
        </div>

        <!-- Rejection (e.g. non-v1 state.json → CLI upgrade hint). -->
        <div
          v-else-if="projectError"
          class="max-w-lg rounded-[10px] border border-(--color-accent) bg-(--color-accent-soft) p-4"
        >
          <p>Couldn't open that folder:</p>
          <pre class="my-2 whitespace-pre-wrap font-sans text-sm">{{ projectError }}</pre>
          <button
            type="button"
            :class="[btnSecondary, 'px-3 py-1.5 text-xs']"
            @click="chooseFolder"
          >
            Choose a different folder
          </button>
        </div>

        <!-- Folder open: list readable topics + chat surface. -->
        <TopicList v-else-if="project" :project="project" />
      </section>
    </div>
  </main>
</template>
