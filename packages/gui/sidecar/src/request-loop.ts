import {
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type SessionInfo,
} from '@earendil-works/pi-coding-agent';
import { type TextContent } from '@earendil-works/pi-ai';
import { z } from 'zod';

const AgentRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('user_message'),
    text: z.string(),
    sessionId: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal('slash_command'),
    text: z.string(),
    sessionId: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal('cancel'),
    sessionId: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal('ui_response'),
    requestId: z.string(),
    value: z.unknown(),
  }),
  z.object({
    kind: z.literal('list_sessions'),
    cwd: z.string(),
  }),
  z.object({
    kind: z.literal('load_session'),
    sessionId: z.string(),
    cwd: z.string().nullable().optional(),
  }),
]);
type AgentRequest = z.infer<typeof AgentRequestSchema>;

interface SessionMeta {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

type ChatBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      args: unknown;
      status: 'ok' | 'error';
      result: string | null;
    };

type ChatRow = { role: 'user'; text: string } | { role: 'assistant'; blocks: ChatBlock[] };

type SessionMessages = ReturnType<SessionManager['buildSessionContext']>['messages'];

export interface SlashContext {
  session: AgentSession;
  cwd: string;
  awaitUiResponse: (requestId: string) => Promise<unknown>;
}

export interface RequestLoopDeps {
  session: AgentSession;
  cwd: string;
}

function emitLine(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function adaptEvent(sessionId: string, event: AgentSessionEvent): unknown | null {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    return {
      session_id: sessionId,
      event: { type: 'text_delta', delta: event.assistantMessageEvent.delta },
    };
  }
  if (event.type === 'agent_end') {
    return { session_id: sessionId, event: { type: 'done' } };
  }
  return null;
}

async function handleSlash(_text: string, _ctx: SlashContext): Promise<boolean> {
  return false;
}

function toSessionMeta(info: SessionInfo): SessionMeta {
  return {
    id: info.id,
    title: info.name ?? info.firstMessage,
    created_at: info.created.toISOString(),
    updated_at: info.modified.toISOString(),
    message_count: info.messageCount,
  };
}

function isText(content: unknown): content is TextContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    (content as { type?: string }).type === 'text'
  );
}

function joinText(contents: Array<{ type: string }>): string {
  return contents
    .filter(isText)
    .map((part) => (part as TextContent).text)
    .join('');
}

function messagesToChatRows(messages: SessionMessages): ChatRow[] {
  const toolOutcomes = new Map<string, { status: 'ok' | 'error'; result: string | null }>();
  for (const message of messages) {
    if (message.role === 'toolResult') {
      toolOutcomes.set(message.toolCallId, {
        status: message.isError ? 'error' : 'ok',
        result: joinText(message.content),
      });
    }
  }

  const rows: ChatRow[] = [];
  for (const message of messages) {
    if (message.role === 'user') {
      const text =
        typeof message.content === 'string' ? message.content : joinText(message.content);
      rows.push({ role: 'user', text });
      continue;
    }
    if (message.role === 'assistant') {
      const blocks: ChatBlock[] = [];
      for (const part of message.content) {
        if (part.type === 'text') {
          blocks.push({ type: 'text', text: part.text });
          continue;
        }
        if (part.type === 'toolCall') {
          const outcome = toolOutcomes.get(part.id);
          if (!outcome) continue;
          blocks.push({
            type: 'tool_call',
            id: part.id,
            name: part.name,
            args: part.arguments,
            status: outcome.status,
            result: outcome.result,
          });
        }
      }
      if (blocks.length > 0) {
        rows.push({ role: 'assistant', blocks });
      }
    }
  }
  return rows;
}

async function loadSessionRows(sessionId: string, cwd: string): Promise<ChatRow[] | null> {
  const sessions = await SessionManager.list(cwd);
  const target = sessions.find((info) => info.id === sessionId);
  if (!target) return null;
  const manager = SessionManager.open(target.path);
  const { messages } = manager.buildSessionContext();
  return messagesToChatRows(messages);
}

export function runRequestLoop(deps: RequestLoopDeps, initialRest: Buffer): void {
  const { session, cwd } = deps;
  const waitMap = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  const awaitUiResponse = (requestId: string, timeoutMs = 30_000): Promise<unknown> =>
    new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (waitMap.delete(requestId)) {
          reject(new Error(`sidecar: ui_response timed out: ${requestId}`));
        }
      }, timeoutMs);
      waitMap.set(requestId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });

  const rejectAllPending = (error: Error): void => {
    for (const [id, pending] of waitMap) {
      waitMap.delete(id);
      pending.reject(error);
    }
  };

  emitLine({ type: 'session_id', session_id: session.sessionId });
  session.subscribe((event) => {
    const line = adaptEvent(session.sessionId, event);
    if (line) emitLine(line);
  });

  const slashContext: SlashContext = { session, cwd, awaitUiResponse };

  const dispatch = async (frame: AgentRequest): Promise<void> => {
    switch (frame.kind) {
      case 'user_message': {
        if (frame.text.startsWith('/')) {
          const handled = await handleSlash(frame.text, slashContext);
          if (handled) return;
        }
        await session.prompt(frame.text);
        return;
      }
      case 'slash_command': {
        const handled = await handleSlash(frame.text, slashContext);
        if (handled) return;
        await session.prompt(frame.text);
        return;
      }
      case 'cancel': {
        rejectAllPending(new Error('sidecar: session cancelled'));
        await session.abort();
        return;
      }
      case 'ui_response': {
        const pending = waitMap.get(frame.requestId);
        if (!pending) {
          process.stderr.write(`sidecar: ui_response for unknown requestId "${frame.requestId}"\n`);
          return;
        }
        waitMap.delete(frame.requestId);
        pending.resolve(frame.value);
        return;
      }
      case 'list_sessions': {
        const sessions = await SessionManager.list(frame.cwd);
        emitLine({ type: 'list_sessions_reply', sessions: sessions.map(toSessionMeta) });
        return;
      }
      case 'load_session': {
        const rows = await loadSessionRows(frame.sessionId, frame.cwd ?? cwd);
        emitLine({
          type: 'load_session_reply',
          session_id: frame.sessionId,
          rows: rows ?? [],
          found: rows !== null,
        });
        return;
      }
    }
  };

  let buffer = initialRest.toString('utf8');

  const handleLine = (raw: string): void => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line.length === 0) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      process.stderr.write(`sidecar: rejected malformed stdin frame: ${String(err)}\n`);
      return;
    }
    const result = AgentRequestSchema.safeParse(parsed);
    if (!result.success) {
      process.stderr.write(`sidecar: rejected invalid stdin frame: ${result.error.message}\n`);
      return;
    }
    void dispatch(result.data).catch((err) => {
      process.stderr.write(`sidecar: frame handler error: ${String(err)}\n`);
    });
  };

  const drainBuffer = (): void => {
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      handleLine(line);
      newlineIndex = buffer.indexOf('\n');
    }
  };

  drainBuffer();

  process.stdin.on('data', (chunk: string | Buffer) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    drainBuffer();
  });

  process.stdin.on('end', () => {
    rejectAllPending(new Error('sidecar: stdin closed'));
    session.dispose();
    process.exit(0);
  });
}
