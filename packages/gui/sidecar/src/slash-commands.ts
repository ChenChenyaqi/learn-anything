import { randomUUID } from 'node:crypto';
import { SessionManager, type AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { toSessionMeta, type SessionMeta } from './types.ts';
import { emitAgentEvent, emitLine, emitUiRequest } from './stdout-writer.ts';

export interface SlashContext {
  runtime: AgentSessionRuntime;
  cwd: string;
  awaitUiResponse: (requestId: string, timeoutMs?: number) => Promise<unknown>;
}

const HELP_TEXT = [
  'Available commands:',
  '/new — Start a fresh session',
  '/sessions — List and switch to a previous session',
  '/compact [instructions] — Compact conversation history',
  '/model [name] — Cycle or set the active model',
  '/clear — Alias for /new',
  '/help — Show this help',
].join('\n');

function parseSlash(text: string): { command: string; args: string } {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return { command: '', args: '' };
  const rest = trimmed.slice(1);
  const spaceIdx = rest.indexOf(' ');
  if (spaceIdx === -1) return { command: rest, args: '' };
  return { command: rest.slice(0, spaceIdx), args: rest.slice(spaceIdx + 1).trim() };
}

function emitText(ctx: SlashContext, text: string): void {
  const sid = ctx.runtime.session.sessionId;
  emitAgentEvent(sid, { type: 'text_delta', delta: text });
  emitAgentEvent(sid, { type: 'done' });
}

function emitSessionId(ctx: SlashContext): void {
  emitLine({ type: 'session_id', session_id: ctx.runtime.session.sessionId });
}

export async function handleSlash(text: string, ctx: SlashContext): Promise<boolean> {
  const { command, args } = parseSlash(text);

  switch (command) {
    case 'new':
    case 'clear': {
      const { cancelled } = await ctx.runtime.newSession();
      if (!cancelled) emitSessionId(ctx);
      return true;
    }
    case 'sessions': {
      const sessions = await SessionManager.list(ctx.cwd);
      const metas: SessionMeta[] = sessions.map(toSessionMeta);
      const requestId = randomUUID();
      emitUiRequest(requestId, 'select_session', { sessions: metas });
      const selected = await ctx.awaitUiResponse(requestId);
      if (typeof selected === 'string') {
        const target = sessions.find((s) => s.id === selected);
        if (target) {
          const { cancelled } = await ctx.runtime.switchSession(target.path);
          if (!cancelled) emitSessionId(ctx);
        }
      }
      return true;
    }
    case 'compact': {
      await ctx.runtime.session.compact(args || undefined);
      emitText(ctx, 'Session compacted.');
      return true;
    }
    case 'help': {
      emitText(ctx, HELP_TEXT);
      return true;
    }
    case 'model': {
      const session = ctx.runtime.session;
      if (!args) {
        const result = await session.cycleModel();
        if (result?.model) {
          emitText(ctx, `Switched to ${result.model.provider}/${result.model.id}`);
        } else {
          emitText(ctx, 'No other models available.');
        }
      } else {
        const currentModel = session.model;
        if (!currentModel) {
          emitText(ctx, 'No model currently active.');
          return true;
        }
        const registry = ctx.runtime.services.modelRegistry;
        const model = registry.find(currentModel.provider, args);
        if (model) {
          await session.setModel(model);
          emitText(ctx, `Switched to ${model.provider}/${model.id}`);
        } else {
          emitText(ctx, `Model "${args}" not found for provider "${currentModel.provider}".`);
        }
      }
      return true;
    }
    default:
      return false;
  }
}
