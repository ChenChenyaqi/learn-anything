import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { useAgentSession } from '@/components/agent-chat/useAgentSession';
import {
  agentCancel,
  agentListSessions,
  agentLoadSession,
  agentNewSession,
  agentSend,
  agentSwitchSession,
} from '@/lib/commands';
import type { ChatMessage, ChatRow, SessionMeta } from '@/lib/commands';

vi.mock('@/lib/commands', () => ({
  agentNewSession: vi.fn(),
  agentSend: vi.fn(),
  agentCancel: vi.fn(),
  agentListSessions: vi.fn(),
  agentLoadSession: vi.fn(),
  agentSwitchSession: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

const mockAgentNewSession = vi.mocked(agentNewSession);
const mockAgentSend = vi.mocked(agentSend);
const mockAgentCancel = vi.mocked(agentCancel);
const mockAgentListSessions = vi.mocked(agentListSessions);
const mockAgentLoadSession = vi.mocked(agentLoadSession);
const mockAgentSwitchSession = vi.mocked(agentSwitchSession);
const mockListen = vi.mocked(listen);

function meta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id: 's1',
    title: 'Test session',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    message_count: 3,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setupComposable(workingFolder: string | null = '/proj') {
  const handlers: Record<string, (payload: unknown) => void> = {};

  (mockListen as any).mockImplementation(
    (event: string, handler: (e: { payload: unknown }) => void) => {
      handlers[event] = (payload: unknown) => handler({ payload });
      return Promise.resolve(() => {});
    },
  );

  mockAgentNewSession.mockResolvedValue({ session_id: 's1' });
  mockAgentSend.mockResolvedValue(undefined);
  mockAgentCancel.mockResolvedValue(undefined);
  mockAgentListSessions.mockResolvedValue([]);

  const scope = effectScope();
  const session = scope.run(() => useAgentSession())!;

  return {
    scope,
    session,
    workingFolder,
    emit(eventName: string, payload: unknown) {
      handlers[eventName]?.(payload);
    },
  };
}

describe('useAgentSession', () => {
  beforeEach(() => {
    mockAgentNewSession.mockReset();
    mockAgentSend.mockReset();
    mockAgentCancel.mockReset();
    mockAgentListSessions.mockReset();
    mockAgentLoadSession.mockReset();
    mockAgentSwitchSession.mockReset();
    mockListen.mockReset();
  });

  describe('boot', () => {
    it('boots a session, stores sessionId, and preloads sessions', async () => {
      mockAgentNewSession.mockResolvedValue({ session_id: 'abc' });
      mockAgentListSessions.mockResolvedValue([meta({ id: 'old1' })]);
      mockListen.mockResolvedValue(() => {});

      const scope = effectScope();
      const { sessionId, messages, sessions, boot } = scope.run(() => useAgentSession())!;
      await boot('/proj');

      expect(sessionId.value).toBe('abc');
      expect(messages.value).toEqual([]);
      expect(sessions.value).toEqual([meta({ id: 'old1' })]);
      expect(mockAgentNewSession).toHaveBeenCalledWith('/proj');
      expect(mockAgentListSessions).toHaveBeenCalledWith('/proj');
      expect(mockListen).toHaveBeenCalledWith('agent:event', expect.any(Function));

      scope.stop();
    });

    it('subscribes only once across multiple boots', async () => {
      mockAgentNewSession.mockResolvedValue({ session_id: 's1' });
      mockAgentListSessions.mockResolvedValue([]);
      mockListen.mockResolvedValue(() => {});

      const scope = effectScope();
      const { boot } = scope.run(() => useAgentSession())!;
      await boot('/proj');
      await boot('/proj');

      expect(mockListen).toHaveBeenCalledTimes(1);

      scope.stop();
    });

    it('does not race on concurrent boot calls (ensureListeners caches)', async () => {
      const deferred = createDeferred<() => void>();
      mockListen.mockReturnValue(deferred.promise);
      mockAgentNewSession.mockResolvedValue({ session_id: 's1' });
      mockAgentListSessions.mockResolvedValue([]);

      const scope = effectScope();
      const { boot } = scope.run(() => useAgentSession())!;

      const boot1 = boot('/proj');
      const boot2 = boot('/proj');
      deferred.resolve(() => {});
      await Promise.all([boot1, boot2]);

      expect(mockListen).toHaveBeenCalledTimes(1);

      scope.stop();
    });

    it('calls the unlisten function on scope disposal', async () => {
      const unlisten = vi.fn();
      mockListen.mockImplementation(() => Promise.resolve(unlisten));
      mockAgentNewSession.mockResolvedValue({ session_id: 's1' });
      mockAgentListSessions.mockResolvedValue([]);

      const scope = effectScope();
      const { boot } = scope.run(() => useAgentSession())!;
      await boot('/proj');

      expect(unlisten).not.toHaveBeenCalled();

      scope.stop();

      expect(unlisten).toHaveBeenCalledTimes(1);
    });
  });

  describe('event stream → messages', () => {
    it('accumulates text_delta → tool_call → tool_result → done', async () => {
      const { session, emit, scope } = setupComposable();
      await session.boot('/proj');

      await session.send('list files');

      expect(session.busy.value).toBe(true);
      expect(session.messages.value).toHaveLength(1);
      expect(session.messages.value[0]).toEqual({ role: 'user', text: 'list files' });

      emit('agent:event', {
        session_id: 's1',
        event: { type: 'text_delta', delta: 'Running ls...' },
      });
      emit('agent:event', {
        session_id: 's1',
        event: { type: 'tool_call', id: 't1', name: 'bash', args: { cmd: 'ls' } },
      });
      emit('agent:event', {
        session_id: 's1',
        event: {
          type: 'tool_result',
          id: 't1',
          name: 'bash',
          status: 'ok',
          result: 'file.txt',
        },
      });
      emit('agent:event', { session_id: 's1', event: { type: 'done' } });

      expect(session.messages.value).toHaveLength(2);
      expect(session.messages.value[1]).toEqual({
        role: 'assistant',
        blocks: [
          { type: 'text', text: 'Running ls...' },
          {
            type: 'tool_call',
            id: 't1',
            name: 'bash',
            args: { cmd: 'ls' },
            status: 'ok',
            result: 'file.txt',
          },
        ],
      });
      expect(session.busy.value).toBe(false);

      scope.stop();
    });

    it('accumulates multiple text_delta into the same text block', async () => {
      const { session, emit, scope } = setupComposable();
      await session.boot('/proj');
      await session.send('hello');

      emit('agent:event', {
        session_id: 's1',
        event: { type: 'text_delta', delta: 'Hello' },
      });
      emit('agent:event', {
        session_id: 's1',
        event: { type: 'text_delta', delta: ' world' },
      });
      emit('agent:event', { session_id: 's1', event: { type: 'done' } });

      const assistant = session.messages.value[1] as Extract<ChatMessage, { role: 'assistant' }>;
      expect(assistant.blocks).toEqual([{ type: 'text', text: 'Hello world' }]);

      scope.stop();
    });

    it('appends error text and clears busy on error event', async () => {
      const { session, emit, scope } = setupComposable();
      await session.boot('/proj');
      await session.send('do something');

      emit('agent:event', {
        session_id: 's1',
        event: { type: 'text_delta', delta: 'Working...' },
      });
      emit('agent:event', {
        session_id: 's1',
        event: { type: 'error', message: 'something broke' },
      });

      const assistant = session.messages.value[1] as Extract<ChatMessage, { role: 'assistant' }>;
      expect(assistant.blocks).toHaveLength(2);
      expect(assistant.blocks[1]).toEqual({ type: 'text', text: 'something broke' });
      expect(session.busy.value).toBe(false);

      scope.stop();
    });

    it('ignores events for a different session_id', async () => {
      const { session, emit, scope } = setupComposable();
      await session.boot('/proj');

      emit('agent:event', {
        session_id: 'other',
        event: { type: 'text_delta', delta: 'should be ignored' },
      });

      expect(session.messages.value).toHaveLength(0);

      scope.stop();
    });

    it('updates tool_call status from running to the result on tool_result', async () => {
      const { session, emit, scope } = setupComposable();
      await session.boot('/proj');
      await session.send('run tool');

      emit('agent:event', {
        session_id: 's1',
        event: { type: 'tool_call', id: 't1', name: 'write', args: { path: 'a.txt' } },
      });

      const before = session.messages.value[1] as Extract<ChatMessage, { role: 'assistant' }>;
      expect(before.blocks[0]).toMatchObject({ status: 'running', result: null });

      emit('agent:event', {
        session_id: 's1',
        event: {
          type: 'tool_result',
          id: 't1',
          name: 'write',
          status: 'error',
          result: 'permission denied',
        },
      });

      const after = session.messages.value[1] as Extract<ChatMessage, { role: 'assistant' }>;
      expect(after.blocks[0]).toMatchObject({ status: 'error', result: 'permission denied' });

      scope.stop();
    });

    it('ignores tool_result for an unknown tool call id', async () => {
      const { session, emit, scope } = setupComposable();
      await session.boot('/proj');
      await session.send('run');

      emit('agent:event', {
        session_id: 's1',
        event: { type: 'tool_call', id: 't1', name: 'bash', args: {} },
      });
      emit('agent:event', {
        session_id: 's1',
        event: {
          type: 'tool_result',
          id: 'nonexistent',
          name: 'bash',
          status: 'ok',
          result: 'x',
        },
      });
      emit('agent:event', { session_id: 's1', event: { type: 'done' } });

      const assistant = session.messages.value[1] as Extract<ChatMessage, { role: 'assistant' }>;
      expect(assistant.blocks).toHaveLength(1);
      expect(assistant.blocks[0]).toMatchObject({ id: 't1', status: 'running' });

      scope.stop();
    });
  });

  describe('send — slash routing', () => {
    it('routes /new to the slash command (not agentSend)', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');

      await session.send('/new');

      expect(mockAgentSend).not.toHaveBeenCalled();
      expect(mockAgentNewSession).toHaveBeenCalledTimes(1);
      scope.stop();
    });

    it('creates a new session via /new when the transcript has messages', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');
      session.messages.value.push({ role: 'user', text: 'hello' });

      await session.send('/new');

      expect(mockAgentSend).not.toHaveBeenCalled();
      expect(mockAgentNewSession).toHaveBeenCalledTimes(2);
      scope.stop();
    });

    it('routes /sessions to the slash command (opens sessionsOpen)', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');

      await session.send('/sessions');

      expect(mockAgentSend).not.toHaveBeenCalled();
      expect(session.sessionsOpen.value).toBe(true);
      scope.stop();
    });

    it('forwards unknown slash commands to agentSend', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');

      await session.send('/compact');

      expect(mockAgentSend).toHaveBeenCalledWith('s1', '/compact');
      expect(session.messages.value).toHaveLength(1);
      expect(session.messages.value[0]).toEqual({ role: 'user', text: '/compact' });
      scope.stop();
    });

    it('ignores empty input', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');

      await session.send('   ');

      expect(mockAgentSend).not.toHaveBeenCalled();
      expect(session.messages.value).toHaveLength(0);
      scope.stop();
    });
  });

  describe('cancel', () => {
    it('calls agentCancel with the session id', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');

      await session.cancel();

      expect(mockAgentCancel).toHaveBeenCalledWith('s1');
      scope.stop();
    });
  });

  describe('send — busy guard', () => {
    it('blocks regular messages while busy', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');

      await session.send('first');
      expect(session.busy.value).toBe(true);

      await session.send('second');

      expect(mockAgentSend).toHaveBeenCalledTimes(1);
      expect(session.messages.value).toHaveLength(1);
      scope.stop();
    });

    it('resets busy and appends error text when agentSend throws', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');
      mockAgentSend.mockRejectedValue(new Error('ipc died'));

      await session.send('hello');

      expect(session.busy.value).toBe(false);
      expect(session.messages.value).toHaveLength(2);
      const assistant = session.messages.value[1] as Extract<ChatMessage, { role: 'assistant' }>;
      expect(assistant.blocks).toEqual([{ type: 'text', text: 'Error: ipc died' }]);
      scope.stop();
    });
  });

  describe('loadSessions', () => {
    it('populates sessions ref from agentListSessions', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');

      mockAgentListSessions.mockResolvedValue([meta({ id: 'fresh' })]);
      session.sessions.value = [];

      await session.loadSessions();

      expect(mockAgentListSessions).toHaveBeenLastCalledWith('/proj');
      expect(session.sessions.value).toEqual([meta({ id: 'fresh' })]);
      scope.stop();
    });
  });

  describe('closeSessions', () => {
    it('closes the panel', async () => {
      const { session, scope } = setupComposable();
      await session.boot('/proj');
      session.sessionsOpen.value = true;

      session.closeSessions();

      expect(session.sessionsOpen.value).toBe(false);
      scope.stop();
    });
  });

  describe('restore', () => {
    it('switches the sidecar session, then loads rows and flips sessionId', async () => {
      const rows: ChatRow[] = [
        { role: 'user', text: 'hi' },
        { role: 'assistant', blocks: [{ type: 'text', text: 'hello' }] },
      ];
      const switchOrder: string[] = [];
      mockAgentSwitchSession.mockImplementation(async () => {
        switchOrder.push('switch');
      });
      mockAgentLoadSession.mockImplementation(async () => {
        switchOrder.push('load');
        return rows;
      });
      const { session, scope } = setupComposable();
      await session.boot('/proj');
      session.sessionsOpen.value = true;

      await session.restore('old-session');

      // switch must happen before load (await confirmation before showing).
      expect(switchOrder).toEqual(['switch', 'load']);
      expect(mockAgentSwitchSession).toHaveBeenCalledWith('old-session', '/proj');
      expect(mockAgentLoadSession).toHaveBeenCalledWith('old-session', '/proj');
      expect(session.messages.value).toEqual(rows);
      expect(session.sessionId.value).toBe('old-session');
      expect(session.sessionsOpen.value).toBe(false);
      scope.stop();
    });
  });

  describe('newSession', () => {
    it('resets state and creates a fresh session', async () => {
      mockAgentNewSession.mockResolvedValueOnce({ session_id: 's1' });
      mockAgentNewSession.mockResolvedValueOnce({ session_id: 's2' });
      mockAgentListSessions.mockResolvedValue([]);
      const { session, scope } = setupComposable();
      await session.boot('/proj');

      session.messages.value.push({ role: 'user', text: 'old' });
      session.busy.value = true;

      await session.newSession();

      expect(session.sessionId.value).toBe('s2');
      expect(session.messages.value).toEqual([]);
      expect(session.busy.value).toBe(false);
      scope.stop();
    });
  });
});
