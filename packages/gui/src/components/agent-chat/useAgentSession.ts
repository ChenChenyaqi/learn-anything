import { getCurrentScope, onScopeDispose, ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import {
  agentCancel,
  agentListSessions,
  agentLoadSession,
  agentNewSession,
  agentSend,
  agentSwitchSession,
} from '@/lib/commands';
import type { AgentEvent, ChatBlock, ChatMessage, SessionMeta } from '@/lib/commands';
import { matchInput, type SlashCommandContext } from './slash-commands';

export function useAgentSession() {
  const sessionId = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const busy = ref(false);
  const sessionsOpen = ref(false);
  const sessions = ref<SessionMeta[]>([]);
  const sessionsQuery = ref('');

  let workingFolder: string | null = null;
  let assistantInProgress = false;
  let unlistenEvent: (() => void) | null = null;
  let listenersPromise: Promise<void> | null = null;

  /* ── event dispatch ──────────────────────────────────────────────── */

  function ensureAssistant(): { role: 'assistant'; blocks: ChatBlock[] } {
    const last = messages.value[messages.value.length - 1];
    if (assistantInProgress && last && last.role === 'assistant') {
      return last;
    }
    messages.value.push({ role: 'assistant', blocks: [] });
    assistantInProgress = true;
    return messages.value[messages.value.length - 1] as {
      role: 'assistant';
      blocks: ChatBlock[];
    };
  }

  function handleAgentEvent(payload: { session_id: string; event: AgentEvent }) {
    if (payload.session_id !== sessionId.value) return;

    switch (payload.event.type) {
      case 'text_delta': {
        const msg = ensureAssistant();
        const last = msg.blocks[msg.blocks.length - 1];
        if (last && last.type === 'text') {
          last.text += payload.event.delta;
        } else {
          msg.blocks.push({ type: 'text', text: payload.event.delta });
        }
        break;
      }
      case 'tool_call': {
        const msg = ensureAssistant();
        msg.blocks.push({
          type: 'tool_call',
          id: payload.event.id,
          name: payload.event.name,
          args: payload.event.args,
          status: 'running',
          result: null,
        });
        break;
      }
      case 'tool_result': {
        const msg = ensureAssistant();
        const { id, status, result } = payload.event;
        const block = msg.blocks.find((b) => b.type === 'tool_call' && b.id === id);
        if (block && block.type === 'tool_call') {
          block.status = status;
          block.result = result;
        }
        break;
      }
      case 'done':
        assistantInProgress = false;
        busy.value = false;
        break;
      case 'error': {
        const msg = ensureAssistant();
        msg.blocks.push({ type: 'text', text: payload.event.message });
        assistantInProgress = false;
        busy.value = false;
        break;
      }
    }
  }

  /* ── slash-command context ───────────────────────────────────────── */

  function buildSlashCtx(): SlashCommandContext {
    return {
      messages: messages.value,
      newSession,
      setSessionsOpen: (v: boolean) => {
        sessionsOpen.value = v;
      },
    };
  }

  /* ── public methods ──────────────────────────────────────────────── */

  function ensureListeners(): Promise<void> {
    if (!listenersPromise) {
      listenersPromise = (async () => {
        unlistenEvent = await listen<{ session_id: string; event: AgentEvent }>(
          'agent:event',
          (e) => handleAgentEvent(e.payload),
        );
      })();
    }
    return listenersPromise;
  }

  async function boot(folder?: string | null) {
    workingFolder = folder ?? null;

    await ensureListeners();

    const result = await agentNewSession(workingFolder);
    sessionId.value = result.session_id;
    messages.value = [];
    busy.value = false;
    sessionsOpen.value = false;
    assistantInProgress = false;
    sessions.value = await agentListSessions(workingFolder);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (trimmed === '') return;

    if (trimmed.startsWith('/')) {
      const result = matchInput(trimmed);
      if (result) {
        const cmd = result.matches.find((c) => c.name === result.query);
        if (cmd && cmd.run) {
          await cmd.run(buildSlashCtx());
          return;
        }
      }
    }

    if (busy.value) return;
    if (!sessionId.value) return;

    messages.value.push({ role: 'user', text: trimmed });
    busy.value = true;
    assistantInProgress = false;

    try {
      await agentSend(sessionId.value, trimmed);
    } catch (e) {
      const msg = ensureAssistant();
      msg.blocks.push({ type: 'text', text: String(e) });
      assistantInProgress = false;
      busy.value = false;
    }
  }

  async function cancel() {
    if (!sessionId.value) return;
    await agentCancel(sessionId.value);
  }

  async function newSession() {
    busy.value = false;
    assistantInProgress = false;
    const result = await agentNewSession(workingFolder);
    sessionId.value = result.session_id;
    messages.value = [];
    sessions.value = await agentListSessions(workingFolder);
  }

  async function restore(id: string) {
    // Switch the sidecar's active session FIRST (await confirmation), so
    // subsequent prompts route to the right session and event session_ids
    // match `sessionId.value` below.
    await agentSwitchSession(id, workingFolder);
    messages.value = await agentLoadSession(id, workingFolder);
    sessionId.value = id;
    sessionsOpen.value = false;
    assistantInProgress = false;
  }

  async function loadSessions() {
    sessions.value = await agentListSessions(workingFolder);
  }

  function closeSessions() {
    sessionsOpen.value = false;
  }

  /* ── cleanup ─────────────────────────────────────────────────────── */

  if (getCurrentScope()) {
    onScopeDispose(() => {
      unlistenEvent?.();
    });
  }

  return {
    sessionId,
    messages,
    busy,
    sessionsOpen,
    sessions,
    sessionsQuery,
    boot,
    send,
    cancel,
    newSession,
    restore,
    loadSessions,
    closeSessions,
  };
}
