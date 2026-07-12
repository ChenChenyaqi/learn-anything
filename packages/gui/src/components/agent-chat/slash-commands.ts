import type { ChatMessage } from '@/lib/commands';

/**
 * Context passed to `SlashCommand.run`. Built fresh at call time by the
 * composable so `messages` reflects the current transcript.
 *
 * `setSessionsOpen` / `setPendingConfirm` are setter callbacks (not writable
 * ref fields): the composable adapts its reactive refs to this interface,
 * e.g. `setSessionsOpen: (v) => { sessionsOpen.value = v; }`.
 */
export interface SlashCommandContext {
  messages: ChatMessage[];
  newSession: () => void | Promise<void>;
  setSessionsOpen: (open: boolean) => void;
  setPendingConfirm: (confirm: boolean) => void;
}

export interface SlashCommand {
  name: string;
  description: string;
  run: (ctx: SlashCommandContext) => void | Promise<void>;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'new',
    description: 'Start a fresh session',
    run: (ctx) => {
      if (ctx.messages.length > 0) {
        ctx.setPendingConfirm(true);
      } else {
        return ctx.newSession();
      }
    },
  },
  {
    name: 'sessions',
    description: 'Browse past sessions',
    run: (ctx) => ctx.setSessionsOpen(true),
  },
];

/**
 * Detect slash-command input and return matching commands.
 *
 * Returns `null` when the text does not start with `/` (the menu should not
 * appear). Returns `{ query, matches }` otherwise — `matches` may be empty if
 * nothing starts with the typed query.
 */
export function matchInput(text: string): { query: string; matches: SlashCommand[] } | null {
  if (!text.startsWith('/')) return null;
  const query = text.slice(1);
  const matches = SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(query));
  return { query, matches };
}
