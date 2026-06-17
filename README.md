<h1 align="center">Learn Anything</h1>

<p align="center">
  <strong>AI-Powered Recursive Learning System</strong><br />
  Turn your AI coding assistant into an interactive tutor — Socratic method &amp; TDD-style exercises.<br />
  <em>Now with a built-in visual learning dashboard.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/learn-anything-cli"><img src="https://img.shields.io/npm/v/learn-anything-cli?color=blue&label=npm" alt="npm version" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20.0-green" alt="Node.js" /></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-workspace-orange" alt="pnpm workspace" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License MIT" /></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

---

## What is Learn Anything?

**Learn Anything** generates skill and command files for **30+ AI coding tools** — Claude Code, Cursor, Codex, OpenCode, and more. Once generated, your AI assistant gains five slash commands that guide you through systematically mastering any technical topic:

- 🧭 **Choose your own path** — AI generates a knowledge map; you decide what to learn next
- 🎓 **Recursive learning method** — Recursive explanations that follow your curiosity as deep as you want
- 🧪 **TDD-style practice** — Write real code with structured feedback, from beginner to challenge
- 📊 **Spaced repetition** — Smart review that surfaces weak spots when you need them most
- 🔥 **Knowledge visualization** — Heatmap showing exactly where you stand
- 🖥️ **Visual Dashboard** — Browse knowledge maps, session notes, and exercises in a rich web interface

## Quick Start

```bash
# Interactive mode — auto-detects your AI tools and prompts you to choose
npx learn-anything-cli init

# Target specific tools
npx learn-anything-cli init --tools claude

# Or install globally
pnpm add -g learn-anything-cli   # npm install -g learn-anything-cli
learn-anything init
```

### Context7 Integration _(optional)_

During `init` or `update`, you'll be prompted to enable **Context7** for documentation verification. When enabled, the AI fetches official docs and cross-references its explanations against authoritative sources — dramatically improving teaching accuracy.

> **Setup:** Run `npx ctx7 setup` or visit the [Context7 docs](https://context7.com/docs/resources/all-clients) for your AI tool.

### After Init — Five Learning Commands

| Command                  | What it does                                                 |
| :----------------------- | :----------------------------------------------------------- |
| `/learn:topic <name>`    | Initialize a topic, generate a knowledge map, track progress |
| `/learn:explain <name>`  | Recursive learning method — go as deep as you want           |
| `/learn:practice <name>` | TDD-style coding exercises with structured feedback          |
| `/learn:review [name]`   | Spaced repetition review with personalized next-step plan    |
| `/learn:status [name]`   | Knowledge map heatmap — mastery, practice counts, confidence |

### Visual Learning Dashboard

Generate a full-featured web dashboard to browse your learning data:

```bash
# Start the visual dashboard
learn-anything serve

# Or include site files during init/update
learn-anything init --site
learn-anything update --site
```

The dashboard provides:

- **Knowledge Map** — Markdown-rendered overview of your learning topic
- **Session Notes** — Browse and read all learning session notes organized by domain
- **Exercise Viewer** — View starter code, solutions, and practice results with syntax highlighting
- **Dark Mode** — Light/dark theme toggle
- **i18n** — Full English and Chinese interface
- **Hot Reload** — Auto-refresh when you add or modify topic files

## How It Works

```
Your Project/
├── .claude/
│   ├── commands/learn/          # Slash commands for Claude
│   └── skills/                  # Skill files with full workflow instructions
├── .cursor/commands/            # Cursor-specific command format
├── .gemini/commands/learn/      # Gemini TOML-format commands
├── .codex/prompts/              # Codex prompt files
│   ...                          # (30+ other tool formats)
│
├── .learn/                      # 🧠 Your learning data lives here
│   ├── site/                        # Visual learning dashboard (Vue 3 + Vite)
│   └── topics/
│       └── typescript/
│           ├── state.json           # Single source of truth
│           ├── knowledge-map.md     # Auto-rendered from state.json
│           ├── sessions/            # Session history for spaced repetition
│           └── exercises/           # TDD-style coding exercises
└── ...
```

Each AI tool receives **tool-appropriate file formats** via an adapter pattern — YAML frontmatter for Claude, TOML for Gemini, Markdown for Cursor, etc.

## Monorepo Structure

```
learn-anything/
├── packages/
│   ├── cli/                     # learn-anything-cli — published to npm
│   │   ├── site/                 # Vue 3 + Vite visual learning dashboard
│   │   ├── src/
│   │   │   ├── cli/             # Commander.js CLI entry point
│   │   │   ├── core/            # init, config, command generation, templates
│   │   │   ├── i18n/            # en + zh-CN locales
│   │   │   └── utils/           # Filesystem, interactive helpers
│   │   ├── bin/                 # learn-anything binary
│   │   └── package.json
│   └── gui/                     # learn-anything-gui — coming soon 🚧
│       └── README.md
├── pnpm-workspace.yaml          # pnpm workspace config
├── tsconfig.base.json           # Shared compiler options
├── package.json                 # Workspace root (private)
└── pnpm-lock.yaml
```

| Package                                | npm                                                                                                                    | Description                                              |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| [`learn-anything-cli`](./packages/cli) | [![npm](https://img.shields.io/npm/v/learn-anything-cli?color=blue)](https://www.npmjs.com/package/learn-anything-cli) | CLI tool — generate skill/command files for 30+ AI tools |
| `learn-anything-gui`                   | _private_                                                                                                              | Graphical desktop interface _(in development)_           |

## Supported AI Tools

> Manage, Amazon Q Developer, Antigravity, Auggie, Bob Shell, Claude Code, Cline, Codex, ForgeCode, CodeBuddy Code, Continue, CoStrict, Crush, Cursor, Factory Droid, Gemini CLI, GitHub Copilot, iFlow, Junie, Kilo Code, Kiro, OpenCode, Pi, Qoder, Lingma, Qwen Code, RooCode, Trae, Windsurf, and AGENTS.md-compatible assistants.

```bash
# Update existing skill files to the latest version (auto-detects installed tools)
npx learn-anything-cli update
```

## Development

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9

### Setup

```bash
git clone https://github.com/ChenChenyaqi/learn-anything.git
cd learn-anything
pnpm install
```

### Commands

| Command           | Description                          |
| :---------------- | :----------------------------------- |
| `pnpm build`      | Build all packages (`tsc`)           |
| `pnpm test`       | Run all tests (`vitest run`)         |
| `pnpm test:watch` | Run tests in watch mode              |
| `pnpm dev`        | TypeScript watch mode (all packages) |
| `pnpm lint`       | Lint all packages (`eslint`)         |
| `pnpm format`     | Format code (`prettier`)             |
| `pnpm dev:site`   | Dev server for the visual dashboard  |

### Per-Package Commands

```bash
pnpm -F learn-anything-cli build      # Build only CLI
pnpm -F learn-anything-cli test       # Test only CLI
pnpm -F learn-anything-cli dev:cli    # Build and run CLI locally
```

## Star History

<a href="https://www.star-history.com/?repos=ChenChenyaqi%2Flearn-anything&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=ChenChenyaqi/learn-anything&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=ChenChenyaqi/learn-anything&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=ChenChenyaqi/learn-anything&type=date&legend=top-left" />
  </picture>
</a>

## License

[MIT](./LICENSE) © [yaqi chen](https://github.com/ChenChenyaqi)

---

<p align="center">
  <sub>Built with ❤️ for curious minds · <a href="https://github.com/ChenChenyaqi/learn-anything">GitHub</a> · <a href="./CONTRIBUTING.md">Contributing</a> · <a href="./CHANGELOG.md">Changelog</a></sub>
</p>
