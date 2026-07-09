import { SessionManager, type AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { type TextContent } from '@earendil-works/pi-ai';
import { z } from 'zod';
import { handleSlash, type SlashContext } from './slash-commands.ts';
import { emitLine } from './stdout-writer.ts';
import { subscribeSession } from './session-lifecycle.ts';
import { toSessionMeta, type ChatBlock, type ChatRow } from './types.ts';

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
    kind: z.literal('switch_session'),
    sessionId: z.string(),
    cwd: z.string().nullable().optional(),
    requestId: z.string(),
  }),
  z.object({
    kind: z.literal('list_sessions'),
    cwd: z.string(),
    requestId: z.string(),
  }),
  z.object({
    kind: z.literal('load_session'),
    sessionId: z.string(),
    cwd: z.string().nullable().optional(),
    requestId: z.string(),
  }),
]);
type AgentRequest = z.infer<typeof AgentRequestSchema>;

type SessionMessages = ReturnType<SessionManager['buildSessionContext']>['messages'];

export interface RequestLoopDeps {
  runtime: AgentSessionRuntime;
  cwd: string;
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
  const { runtime, cwd } = deps;

  emitLine({ type: 'session_id', session_id: runtime.session.sessionId });
  subscribeSession(runtime.session);
  runtime.setRebindSession(async (newSession) => {
    subscribeSession(newSession);
  });

  const slashContext: SlashContext = { runtime, cwd };

  const dispatch = async (frame: AgentRequest): Promise<void> => {
    switch (frame.kind) {
      case 'user_message': {
        if (frame.text.startsWith('/')) {
          const handled = await handleSlash(frame.text, slashContext);
          if (handled) return;
        }
        await runtime.session.prompt(frame.text);
        return;
      }
      case 'slash_command': {
        const handled = await handleSlash(frame.text, slashContext);
        if (handled) return;
        await runtime.session.prompt(frame.text);
        return;
      }
      case 'cancel': {
        await runtime.session.abort();
        return;
      }
      case 'switch_session': {
        const sessions = await SessionManager.list(frame.cwd ?? cwd);
        const target = sessions.find((s) => s.id === frame.sessionId);
        let ok = false;
        if (target) {
          const { cancelled } = await runtime.switchSession(target.path);
          ok = !cancelled;
        }
        emitLine({
          type: 'switch_session_reply',
          requestId: frame.requestId,
          session_id: frame.sessionId,
          ok,
        });
        return;
      }
      case 'list_sessions': {
        const sessions = await SessionManager.list(frame.cwd);
        emitLine({
          type: 'list_sessions_reply',
          requestId: frame.requestId,
          sessions: sessions.map(toSessionMeta),
        });
        return;
      }
      case 'load_session': {
        const rows = await loadSessionRows(frame.sessionId, frame.cwd ?? cwd);
        emitLine({
          type: 'load_session_reply',
          requestId: frame.requestId,
          session_id: frame.sessionId,
          rows: rows ?? [],
          found: rows !== null,
        });
        return;
      }
    }
  };

  let buffer = initialRest.toString('utf8');
  let promptChain: Promise<void> = Promise.resolve();

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
    const frame = result.data;
    const run = (): Promise<void> =>
      dispatch(frame).catch((err) => {
        process.stderr.write(`sidecar: frame handler error: ${String(err)}\n`);
      });
    if (
      frame.kind === 'user_message' ||
      frame.kind === 'slash_command' ||
      frame.kind === 'switch_session'
    ) {
      promptChain = promptChain.then(run);
    } else {
      void run();
    }
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
    runtime.session.dispose();
    process.exit(0);
  });
}
