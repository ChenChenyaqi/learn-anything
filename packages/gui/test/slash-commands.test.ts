import { describe, expect, it, vi } from 'vitest';
import { SLASH_COMMANDS, matchInput } from '@/components/agent-chat/slash-commands';
import type { SlashCommandContext } from '@/components/agent-chat/slash-commands';

const noopCtx: SlashCommandContext = {
  messages: [],
  newSession: () => {},
  setSessionsOpen: () => {},
};

describe('matchInput', () => {
  it('returns null for empty input', () => {
    expect(matchInput('')).toBeNull();
  });

  it('returns null for plain text without a leading slash', () => {
    expect(matchInput('hello world')).toBeNull();
  });

  it('returns all commands for a bare leading slash', () => {
    const result = matchInput('/');
    expect(result).not.toBeNull();
    expect(result!.query).toBe('');
    expect(result!.matches).toHaveLength(SLASH_COMMANDS.length);
  });

  it('filters by name prefix when continuing to type after the slash', () => {
    const result = matchInput('/se');
    expect(result).not.toBeNull();
    expect(result!.query).toBe('se');
    expect(result!.matches.map((c) => c.name)).toEqual(['sessions']);
  });

  it('does not trigger on a mid-string slash', () => {
    expect(matchInput('hello /world')).toBeNull();
  });

  it('returns empty matches when no command starts with the query', () => {
    const result = matchInput('/xyz');
    expect(result).not.toBeNull();
    expect(result!.matches).toEqual([]);
  });

  it('filters to a single match by prefix', () => {
    const result = matchInput('/n');
    expect(result).not.toBeNull();
    expect(result!.matches.map((c) => c.name)).toEqual(['new']);
  });
});

describe('/new command', () => {
  const cmd = SLASH_COMMANDS.find((c) => c.name === 'new')!;

  it('does nothing when the transcript is empty', () => {
    const newSession = vi.fn();
    cmd.run!({
      ...noopCtx,
      messages: [],
      newSession,
    });
    expect(newSession).not.toHaveBeenCalled();
  });

  it('creates a session immediately when the transcript has messages', () => {
    const newSession = vi.fn();
    cmd.run!({
      ...noopCtx,
      messages: [{ role: 'user', text: 'hi' }],
      newSession,
    });
    expect(newSession).toHaveBeenCalledTimes(1);
  });
});

describe('/sessions command', () => {
  const cmd = SLASH_COMMANDS.find((c) => c.name === 'sessions')!;

  it('opens the sessions overlay', () => {
    const setSessionsOpen = vi.fn();
    cmd.run!({ ...noopCtx, setSessionsOpen });
    expect(setSessionsOpen).toHaveBeenCalledWith(true);
  });
});
