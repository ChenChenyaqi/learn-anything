# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Learn Anything is a CLI tool (`learn-anything`) that generates skill and command files for AI coding assistants, turning them into interactive learning tutors. It supports 30+ AI tools (Claude Code, Cursor, Gemini CLI, Codex, Copilot, Windsurf, etc.) and outputs localized files in `en` and `zh-CN`.

The generated skills implement 5 learning workflows: topic (initialize a subject), explain (recursive Socratic deep-dive), practice (TDD-style exercises), review (spaced repetition), and status (knowledge map visualization).

## Commands

```bash
pnpm build          # Build all packages (pnpm -r build)
pnpm typecheck      # TypeScript type check with project references (tsc -b)
pnpm test           # Run all tests (vitest run)
pnpm test:watch     # Run tests in watch mode (vitest)
pnpm lint           # ESLint on packages/
pnpm dev:cli        # Build and run the CLI locally from packages/cli/
```

## Architecture

```
packages/
  core/                       # @learn-anything/core — shared domain logic
    src/
      index.ts                # Public API barrel export
      config.ts               # AI_TOOLS array, LEARN_DIR
      learn-protocol/         # Schema, parser, migration, slug, types, render
      templates/              # SkillTemplate, CommandTemplate, workflow templates
        workflows/            # learn-topic.ts, learn-explain.ts, learn-practice.ts,
                              #   learn-review.ts, learn-status.ts
      shared/                 # skill-generation.ts (aggregates templates)
      i18n/                   # getMessages(), detectSystemLocale(), resolveLocale()
        types.ts              # LocaleMessages, CLIMessages, InitMessages types
        locales/
          en.ts, zh-CN.ts     # Top-level locale messages
      utils/                  # FileSystemUtils, isInteractive()

  cli/                        # learn-anything-cli (published to npm)
    bin/learn-anything.js     # CLI entry shim
    src/
      cli/index.ts            # Commander.js CLI
      init.ts                 # InitCommand — orchestrates init workflow
      command-generation/     # Adapter pattern for multi-tool output
        types.ts              # ToolCommandAdapter, GeneratedCommand
        registry.ts           # CommandAdapterRegistry
        generator.ts          # generateCommand / generateCommands
        adapters/             # claude.ts, cursor.ts, codex.ts, gemini.ts
      scripts/                # Standalone .mts scripts (deployed to skill dirs)

  gui/                        # @learn-anything/gui (placeholder, in development)
```

### Key Patterns

- **Templates are locale-aware**: every template getter takes `locale: SupportedLocale` and pulls strings from i18n. The same template produces different content for `en` vs `zh-CN`.
- **Adapter pattern for multi-tool output**: adding support for a new AI tool means creating a new adapter in `packages/cli/src/command-generation/adapters/` that implements `ToolCommandAdapter` (specifying file path conventions and file format) and registering it.
- **Shared data in `./.learn/`**: the CLI creates `./.learn/topics/` in the project directory for learning state that stays with the project.
- **Interactive by default**: when no `--tools` flag is passed and stdin/stdout are TTYs, `learn-anything init` shows an interactive checkbox prompt (via `@inquirer/prompts`) with detected tools pre-selected.

### Adding a new AI tool

1. Add an entry to `AI_TOOLS` in `packages/core/src/config.ts` with the tool's `skillsDir` path.
2. If the tool has custom command file conventions, create an adapter in `packages/cli/src/command-generation/adapters/` and register it in `packages/cli/src/command-generation/adapters/index.ts` and `registry.ts`.
