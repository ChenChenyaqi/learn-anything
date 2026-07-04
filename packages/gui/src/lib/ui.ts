// Shared Tailwind class strings.
//
// Colors reference the design tokens from styles/main.css via Tailwind v4's
// arbitrary-value shorthand `(--color-*)` (the token aliases live in `:root`,
// not `@theme`, so they are addressed as arbitrary values rather than
// generated utilities). Kept here so the button/input vocabulary is consistent
// across components and editable in one place. Sizes are applied separately by
// callers (e.g. `:class="[btnSecondary, 'px-3 py-1.5 text-xs']"`).

export const btnPrimary =
  'inline-flex items-center justify-center rounded-lg border bg-(--color-accent) border-(--color-accent) text-white cursor-pointer transition-colors hover:opacity-90 disabled:opacity-55 disabled:pointer-events-none';

export const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border bg-(--color-surface) border-(--color-rule) text-(--color-ink) cursor-pointer transition-colors hover:bg-(--color-surface-hover) disabled:opacity-55 disabled:pointer-events-none';

export const btnGhost =
  'inline-flex items-center justify-center rounded-lg border border-transparent bg-transparent text-(--color-pencil) cursor-pointer transition-colors hover:text-(--color-ink) disabled:opacity-55 disabled:pointer-events-none';

export const fieldControl =
  'w-full rounded-lg border border-(--color-rule) bg-(--color-surface) px-2.5 py-2 text-sm text-(--color-ink) focus:outline-none focus:border-(--color-accent)';
