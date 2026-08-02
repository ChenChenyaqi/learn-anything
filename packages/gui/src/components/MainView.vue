<script setup lang="ts">
// The "main" application phase: header + content area + persistent agent panel.
// Owns the workspace layout — route switching (overview/topic) via
// `useWorkspaceNav` and the agent-panel resize via `useAgentPanelResize`.
// Folder/config concerns stay in App.vue; this component receives them as props.
import { type AppConfig, type ProjectInfo } from '@/lib/commands';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import AppHeader from './AppHeader.vue';
import OverviewView from './overview/OverviewView.vue';
import WorkspaceView from './workspace/WorkspaceView.vue';
import ResizeHandle from './ResizeHandle.vue';
import AgentChat from './agent-chat/AgentChat.vue';
import { useWorkspaceNav } from '../composables/useWorkspaceNav';
import { useAgentPanelResize } from '../composables/useAgentPanelResize';

defineProps<{
  config: AppConfig | null;
  project: ProjectInfo | null;
  projectError: string;
  folderBusy: boolean;
}>();

const emit = defineEmits<{
  choose: [];
  settings: [];
}>();

const { route } = useWorkspaceNav();
const { width: panelWidth, resizing, start: startResize } = useAgentPanelResize();
</script>

<template>
  <div class="flex h-screen flex-col">
    <AppHeader
      :config="config"
      :project="project"
      :folder-busy="folderBusy"
      @choose="emit('choose')"
      @settings="emit('settings')"
    />

    <section class="flex-1 overflow-hidden p-6">
      <div
        v-if="!config?.last_working_folder && !projectError"
        class="flex flex-col items-center gap-4 pt-12 opacity-85"
      >
        <p>Pick a working folder to start creating topics.</p>
        <button type="button" :class="[btnPrimary, 'px-4 py-2']" @click="emit('choose')">
          Choose folder
        </button>
      </div>

      <div
        v-else-if="projectError"
        class="max-w-lg rounded-[10px] border border-(--color-accent) bg-(--color-accent-soft) p-4"
      >
        <p>Couldn't open that folder:</p>
        <pre class="my-2 whitespace-pre-wrap font-sans text-sm">{{ projectError }}</pre>
        <button
          type="button"
          :class="[btnSecondary, 'px-3 py-1.5 text-xs']"
          @click="emit('choose')"
        >
          Choose a different folder
        </button>
      </div>

      <div v-else-if="project" class="flex h-full">
        <div class="flex-1 min-w-0 overflow-hidden">
          <OverviewView
            v-if="route.name === 'overview'"
            :working-folder="config?.last_working_folder ?? null"
          />
          <WorkspaceView v-else :working-folder="config?.last_working_folder ?? null" />
        </div>
        <ResizeHandle :resizing="resizing" @start="startResize" />
        <AgentChat
          :working-folder="config?.last_working_folder ?? null"
          class="shrink-0 pl-2"
          :style="{ width: panelWidth + 'px' }"
        />
      </div>
    </section>
  </div>
</template>
