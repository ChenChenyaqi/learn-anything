import type { ChatMessage } from '@/lib/commands';
import type { MessageSchema } from '@/i18n/locales/en';

/**
 * Context passed to `SlashCommand.run`. Built fresh at call time by the
 * composable so `messages` reflects the current transcript.
 *
 * `setSessionsOpen` is a setter callback (not a writable ref field): the
 * composable adapts its reactive refs to this interface,
 * e.g. `setSessionsOpen: (v) => { sessionsOpen.value = v; }`.
 */
export interface SlashCommandContext {
  messages: ChatMessage[];
  newSession: () => void | Promise<void>;
  setSessionsOpen: (open: boolean) => void;
}

export interface SlashCommand {
  name: string;
  /** Description locale key (leaf under `chat.cmd.*`), resolved at render
   *  time so descriptions follow the UI language. */
  description: keyof MessageSchema['chat']['cmd'];
  /** Hint shown in the menu, e.g. "<topic-name>". */
  argumentHint?: string;
  /** If true, selecting the command inserts it into the input for the
   *  user to type arguments, rather than sending immediately. */
  takesArgs?: boolean;
  /** If present, the command is handled locally (UI-only). If absent,
   *  the raw text is forwarded to the agent sidecar. */
  run?: (ctx: SlashCommandContext) => void | Promise<void>;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'new',
    description: 'new',
    run: (ctx) => {
      if (ctx.messages.length === 0) return;
      return ctx.newSession();
    },
  },
  {
    name: 'sessions',
    description: 'sessions',
    run: (ctx) => ctx.setSessionsOpen(true),
  },
  {
    name: 'learn-topic',
    description: 'learn-topic',
    argumentHint: '<topic-name>',
    takesArgs: true,
  },
  {
    name: 'learn-explain',
    description: 'learn-explain',
    argumentHint: '<concept-name>',
    takesArgs: true,
  },
  {
    name: 'learn-practice',
    description: 'learn-practice',
    argumentHint: '<concept-name>',
    takesArgs: true,
  },
  {
    name: 'learn-quiz',
    description: 'learn-quiz',
    argumentHint: '<concept-or-domain>',
    takesArgs: true,
  },
  {
    name: 'learn-review',
    description: 'learn-review',
    argumentHint: '[topic-name]',
    takesArgs: true,
  },
  {
    name: 'learn-status',
    description: 'learn-status',
    argumentHint: '[topic-name]',
    takesArgs: true,
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
