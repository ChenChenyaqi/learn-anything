import type { ChatMessage } from '@/lib/commands';

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
  description: string;
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
    description: 'Start a fresh session',
    run: (ctx) => {
      if (ctx.messages.length === 0) return;
      return ctx.newSession();
    },
  },
  {
    name: 'sessions',
    description: 'Browse past sessions',
    run: (ctx) => ctx.setSessionsOpen(true),
  },
  {
    name: 'learn-topic',
    description: 'Initialize or load a learning topic',
    argumentHint: '<topic-name>',
    takesArgs: true,
  },
  {
    name: 'learn-explain',
    description: 'Deep-dive into a concept',
    argumentHint: '<concept-name>',
    takesArgs: true,
  },
  {
    name: 'learn-practice',
    description: 'Hands-on coding practice',
    argumentHint: '<concept-name>',
    takesArgs: true,
  },
  {
    name: 'learn-quiz',
    description: 'Quick text Q&A quiz',
    argumentHint: '<concept-or-domain>',
    takesArgs: true,
  },
  {
    name: 'learn-review',
    description: 'Review learning progress',
    argumentHint: '[topic-name]',
    takesArgs: true,
  },
  {
    name: 'learn-status',
    description: 'Visualize learning state',
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
