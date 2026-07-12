import { type AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { emitAgentEvent, emitLine } from './stdout-writer.ts';
import { isLearnCommand, buildLearnInstruction } from './learn-skills/index.ts';

export interface SlashContext {
  runtime: AgentSessionRuntime;
  cwd: string;
}

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

  // /learn-* commands — instruct the agent to invoke the matching skill.
  // The agent already knows about all learn skills from the system prompt
  // (auto-discovered via additionalSkillPaths). It will read the SKILL.md
  // file and follow the workflow.
  if (isLearnCommand(command)) {
    const instruction = buildLearnInstruction(command, args);
    if (instruction) {
      await ctx.runtime.session.prompt(instruction);
      return true;
    }
  }

  switch (command) {
    case 'new':
    case 'clear': {
      const { cancelled } = await ctx.runtime.newSession();
      if (!cancelled) emitSessionId(ctx);
      return true;
    }
    case 'compact': {
      await ctx.runtime.session.compact(args || undefined);
      emitText(ctx, 'Session compacted.');
      return true;
    }
    default:
      return false;
  }
}
