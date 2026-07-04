<script setup lang="ts">
// Chat dialog — message input, transcript, and agent workflow trigger.
//
// On mount subscribes to `agent:done` / `agent:error` Tauri events so the
// transcript reflects workflow results. When the user sends a message the
// text is forwarded to `chat_create_topic` (the Rust command both emits
// these events AND returns the payload). No live delta rendering — only a
// final "topic created" confirmation on success.

import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { chatCreateTopic, type TopicCreated } from '../lib/commands';
import { btnPrimary, fieldControl } from '../lib/ui';

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
}

const messages = ref<ChatMessage[]>([]);
const input = ref('');
const busy = ref(false);
const transcriptEl = ref<HTMLElement | null>(null);

let unlistenDone: UnlistenFn | null = null;
let unlistenError: UnlistenFn | null = null;

onMounted(async () => {
  unlistenDone = await listen<TopicCreated>('agent:done', (event) => {
    messages.value = [
      ...messages.value,
      { role: 'agent', content: `Topic "${event.payload.topic}" created in ${event.payload.dir}` },
    ];
    busy.value = false;
    scrollToBottom();
  });

  unlistenError = await listen<string>('agent:error', (event) => {
    messages.value = [
      ...messages.value,
      { role: 'agent', content: `Error: ${event.payload}` },
    ];
    busy.value = false;
    scrollToBottom();
  });
});

onUnmounted(() => {
  unlistenDone?.();
  unlistenError?.();
});

async function scrollToBottom() {
  await nextTick();
  transcriptEl.value?.scrollTo({ top: transcriptEl.value.scrollHeight, behavior: 'smooth' });
}

async function send() {
  const text = input.value.trim();
  if (!text || busy.value) return;

  messages.value = [...messages.value, { role: 'user', content: text }];
  input.value = '';
  busy.value = true;
  await nextTick();
  scrollToBottom();

  chatCreateTopic(text).catch((e) => {
    if (busy.value) {
      messages.value = [
        ...messages.value,
        { role: 'agent', content: `Error: ${String(e)}` },
      ];
      busy.value = false;
      scrollToBottom();
    }
  });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="messages.length === 0"
      class="rounded-[10px] border border-(--color-rule) p-4 text-center text-sm opacity-55"
    >
      Describe a topic you want to learn (e.g. "create a topic: JavaScript").
    </div>

    <div
      v-else
      ref="transcriptEl"
      class="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-[10px] border border-(--color-rule) p-4"
    >
      <div
        v-for="(m, i) in messages"
        :key="i"
        :class="[
          'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
          m.role === 'user'
            ? 'self-end bg-(--color-accent) text-white'
            : 'self-start bg-(--color-surface) text-(--color-ink)',
        ]"
      >
        {{ m.content }}
      </div>
      <div v-if="busy" class="self-start text-sm opacity-55">Generating topic…</div>
    </div>

    <div class="flex gap-2">
      <textarea
        v-model="input"
        :class="[fieldControl, 'resize-none']"
        rows="2"
        placeholder="create a topic: JavaScript"
        :disabled="busy"
        @keydown="onKeydown"
      />
      <button
        type="button"
        :class="[btnPrimary, 'self-end px-4 py-2']"
        :disabled="busy || !input.trim()"
        @click="send"
      >
        {{ busy ? '…' : 'Send' }}
      </button>
    </div>
  </div>
</template>
