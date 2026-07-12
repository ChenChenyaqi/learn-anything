// The stdin pump: reads newline-delimited command frames, dispatches them to
// the agent runtime, and serialises prompts onto a single chain so that
// prompts / session switches never overlap.

import { SessionManager, type AgentSessionRuntime } from '@earendil-works/pi-coding-agent';

import { handleSlash, type SlashContext } from './slash-commands.ts';
import { loadSessionRows, toSessionMeta } from './session-history.ts';
import { log } from './log.ts';
import { emitLine } from './stdout-writer.ts';
import { subscribeSession } from './session-lifecycle.ts';
import { AgentRequestSchema, type AgentRequest } from './wire.ts';

export interface RequestLoopDeps {
  runtime: AgentSessionRuntime;
  cwd: string;
}

function describeInbound(frame: AgentRequest): string {
  switch (frame.kind) {
    case 'user_message':
    case 'slash_command':
      return ` (${frame.text.length} chars)`;
    case 'cancel':
      return '';
    case 'switch_session':
    case 'load_session':
      return ` (sid=${frame.sessionId}, req=${frame.requestId})`;
    case 'list_sessions':
      return ` (req=${frame.requestId})`;
  }
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
    log(`dispatch ${frame.kind}`);
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
      log(`rejected malformed stdin frame: ${String(err)}`);
      return;
    }
    const result = AgentRequestSchema.safeParse(parsed);
    if (!result.success) {
      log(`rejected invalid stdin frame: ${result.error.message}`);
      return;
    }
    const frame = result.data;
    log(`← stdin   ${frame.kind}${describeInbound(frame)}`);
    const run = (): Promise<void> =>
      dispatch(frame).catch((err) => {
        log(`frame handler error: ${String(err)}`);
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
    log('← stdin   EOF, disposing session');
    runtime.session.dispose();
    process.exit(0);
  });
}
