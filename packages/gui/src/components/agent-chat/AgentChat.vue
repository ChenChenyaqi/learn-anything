<script setup lang="ts">
// AgentChat — right-panel agent surface.
//
// Composes `useAgentSession` for all state (no direct event subscriptions).
// Owns the input textarea, slash-menu keyboard handling, and the transcript /
// sessions-overlay swap. Child components are stateless or near-stateless —
// everything flows through the composable.

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useAgentSession } from '@/components/agent-chat/useAgentSession.ts';
import { matchInput, type SlashCommand } from '@/components/agent-chat/slash-commands.ts';
import { slashPill, btnPrimary, btnSecondary, fieldControl } from '@/lib/ui.ts';
import SlashMenu from './SlashMenu.vue';
import StreamingMarkdownBlock from './StreamingMarkdownBlock.vue';
import ToolCallCard from './ToolCallCard.vue';
import SessionsPanel from './SessionsPanel.vue';

const props = defineProps<{
  workingFolder: string | null;
}>();

const session = useAgentSession();

const input = ref('');
const slashIndex = ref(0);
const transcriptEl = ref<HTMLElement | null>(null);

/* ── slash menu ─────────────────────────────────────────────────── */

const slashResult = computed(() => matchInput(input.value));
const slashMatches = computed<SlashCommand[]>(() => slashResult.value?.matches ?? []);
const slashOpen = computed(() => slashMatches.value.length > 0);

watch(slashMatches, () => {
  slashIndex.value = 0;
});

function onSlashSelect(index: number) {
  const cmd = slashMatches.value[index];
  if (!cmd) return;
  if (cmd.takesArgs) {
    input.value = '/' + cmd.name + ' ';
  } else {
    input.value = '';
    session.send('/' + cmd.name);
  }
}

function isMessageDone(i: number): boolean {
  return i < session.messages.value.length - 1 || !session.busy.value;
}

/* ── keyboard ───────────────────────────────────────────────────── */

function onKeydown(e: KeyboardEvent) {
  if (slashOpen.value) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      slashIndex.value = Math.max(0, slashIndex.value - 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      slashIndex.value = Math.min(slashMatches.value.length - 1, slashIndex.value + 1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      onSlashSelect(slashIndex.value);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      input.value = '';
      return;
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSend();
  }
}

/* ── send / cancel ──────────────────────────────────────────────── */

function onSend() {
  const text = input.value.trim();
  if (!text || session.busy.value) return;
  input.value = '';
  session.send(text);
}

/* ── auto-scroll ────────────────────────────────────────────────── */

async function scrollToBottom() {
  await nextTick();
  if (transcriptEl.value) {
    transcriptEl.value.scrollTop = transcriptEl.value.scrollHeight;
  }
}

watch(() => session.messages.value.length, scrollToBottom);

watch(session.messages, scrollToBottom, { deep: true });

/* ── lifecycle ──────────────────────────────────────────────────── */

onMounted(() => {
  session.boot(props.workingFolder).catch((e) => {
    console.error('[AgentChat] boot failed:', e);
  });
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-(--color-rule) pb-2">
      <span class="text-sm font-semibold">Agent</span>
      <div class="ml-auto flex items-center gap-1">
        <button type="button" :class="slashPill" @click="session.send('/new')">◇ new</button>
        <button type="button" :class="slashPill" @click="session.send('/sessions')">
          ▤ sessions
        </button>
      </div>
    </div>

    <!-- Content: sessions overlay or transcript -->
    <div class="relative flex-1 overflow-hidden">
      <!-- Sessions overlay -->
      <div v-if="session.sessionsOpen.value" class="absolute inset-0 flex flex-col px-1 pt-3">
        <SessionsPanel
          :sessions="session.sessions.value"
          @select="session.restore($event)"
          @back="session.closeSessions()"
        />
      </div>

      <!-- Transcript -->
      <template v-else>
        <div
          v-if="session.messages.value.length === 0"
          class="flex h-full items-center justify-center px-4 text-center text-sm text-(--color-pencil)"
        >
          Type <span class="font-mono">&nbsp;/&nbsp;</span> for commands, or just ask.
        </div>

        <div v-else ref="transcriptEl" class="flex h-full flex-col gap-3 overflow-y-auto py-3">
          <template v-for="(msg, i) in session.messages.value" :key="i">
            <!-- User message -->
            <div v-if="msg.role === 'user'" class="flex justify-end">
              <div
                class="max-w-[85%] whitespace-pre-wrap rounded-lg bg-(--color-accent) px-3 py-2 text-sm text-white"
              >
                {{ msg.text }}
              </div>
            </div>

            <!-- Assistant message -->
            <div v-else class="flex flex-col gap-1.5">
              <template v-for="(block, j) in msg.blocks" :key="j">
                <StreamingMarkdownBlock
                  v-if="block.type === 'text'"
                  :text="block.text"
                  :done="isMessageDone(i)"
                />
                <ToolCallCard
                  v-else
                  :name="block.name"
                  :args="block.args"
                  :status="block.status"
                  :result="block.result"
                />
              </template>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- Input row -->
    <div class="flex flex-col border-t border-(--color-rule) pt-2">
      <!-- Slash menu popover -->
      <SlashMenu
        v-if="slashOpen"
        :commands="slashMatches"
        :query="slashResult?.query ?? ''"
        :index="slashIndex"
        @select="onSlashSelect"
        @close="input = ''"
      />

      <div class="flex items-end gap-2">
        <textarea
          v-model="input"
          :class="[fieldControl, 'resize-none']"
          rows="2"
          placeholder="Ask anything…"
          @keydown="onKeydown"
        />
        <button
          v-if="session.busy.value"
          type="button"
          :class="[btnSecondary, 'px-4 py-2']"
          @click="session.cancel()"
        >
          Stop
        </button>
        <button
          v-else
          type="button"
          :class="[btnPrimary, 'px-4 py-2']"
          :disabled="!input.trim()"
          @click="onSend"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</template>
