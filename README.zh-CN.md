<p align="center">
  <img src="./logo.png" alt="Learn Anything Logo" width="120" />
</p>

<h1 align="center">Learn Anything</h1>

<p align="center">
  <strong>AI 驱动的递归学习系统</strong><br />
  将你的 AI 编程助手变成交互式导师 — 苏格拉底式教学法 · TDD 风格练习<br />
  <em>现已内置可视化学习仪表盘。</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/learn-anything-cli"><img src="https://img.shields.io/npm/v/learn-anything-cli?color=blue&label=npm" alt="npm 版本" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20.0-green" alt="Node.js" /></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-workspace-orange" alt="pnpm workspace" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="许可证 MIT" /></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

---

## 什么是 Learn Anything？

**Learn Anything** 为 **30+ 种 AI 编程工具**（Claude Code、Cursor、Codex、OpenCode 等）生成 skill 和 command 文件。安装后，你的 AI 助手获得六个斜杠命令，引导你系统性掌握任何技术主题：

- 🧭 **自主选择路径** — AI 生成知识图谱，你来决定学什么
- 🎓 **递归学习法** — 递归讲解跟随你的好奇心，想挖多深就多深
- 🧪 **TDD 风格练习** — 写真实代码，获结构化反馈，从入门到挑战
- 📝 **自适应测验** — 快速文字问答测验，批改后保存为可复用题库
- 📊 **间隔重复** — 智能复习，在最佳时机帮你巩固薄弱环节
- 🔥 **知识可视化** — 热力图直观展示你的掌握状态
- 🖥️ **可视化仪表盘** — 在丰富的 Web 界面中浏览知识图谱、笔记和练习

## 快速开始

```bash
# 交互模式 — 自动检测你的 AI 工具并提示选择
npx learn-anything-cli init

# 指定工具
npx learn-anything-cli init --tools claude

# 或全局安装
pnpm add -g learn-anything-cli   # npm install -g learn-anything-cli
learn-anything init
```

### Context7 集成 _(可选)_

执行 `init` 或 `update` 时会提示是否启用 **Context7** 文档验证。启用后，AI 会获取官方文档并对照权威来源验证其讲解内容——大幅提高教学准确性。

> **安装：** 运行 `npx ctx7 setup` 或访问 [Context7 文档](https://context7.com/docs/resources/all-clients) 查看你的 AI 工具的配置方式。

### 安装后 — 六个学习命令

| 命令                     | 功能                                      |
| :----------------------- | :---------------------------------------- |
| `/learn:topic <名称>`    | 初始化主题，生成知识图谱，跟踪进度        |
| `/learn:explain <名称>`  | 递归式学习法 — 想挖多深就挖多深           |
| `/learn:practice <名称>` | TDD 风格编码练习，结构化反馈              |
| `/learn:review [名称]`   | 间隔重复复习，个性化下一步计划            |
| `/learn:status [名称]`   | 知识图谱热力图 — 掌握度、练习次数、信心分 |
| `/learn:quiz <名称>`     | 快速文字问答测验 — 批改并保存，可反复练习 |

### 可视化学习仪表盘

在任意目录运行 `learn-anything serve` 即可打开**全局仪表盘**。更新后的 topic
技能在新建或加载主题时，通过 `init-sessions.mjs` 自动登记主题。学习文件仍保存在
原项目中，用户级索引仅记录绝对路径，默认位于 `~/.learn-anything/topics/`；可通过
`LEARN_ANYTHING_HOME` 环境变量指定独立的索引目录。

升级后，先运行 `learn-anything update <项目路径>` 更新已安装的技能。已有主题也可以
直接导入，无需重新开始学习：

```bash
learn-anything register "项目的绝对路径"
learn-anything serve
```

仪表盘中的**管理已登记主题**支持导入项目、`.learn/topics` 或单个主题的绝对路径，
显示不可用的路径或无效主题，并可移除登记。移除登记不会删除任何学习文件；再次通过
更新后的 topic 技能打开主题时会重新登记。项目移动后，可导入新位置并移除旧登记。
不同项目中的同名主题会分别显示，并标注来源路径。

如需只查看一个项目，运行 `learn-anything serve <项目路径>`（或 `serve .`）。
不指定路径启动时，也会导入当前项目中已有的主题。仪表盘仅监听本机回环地址；
索引仅对当前用户生效，不会在不同设备之间同步学习数据。

一键启动零配置的 Web 仪表盘来浏览你的学习数据：

```bash
# 启动可视化仪表盘（无需 npm install）
npx learn-anything-cli serve

# 自定义端口
npx learn-anything-cli serve --port 8080

# 禁止自动打开浏览器
npx learn-anything-cli serve --no-open
```

> 仪表盘已在 CLI 中预构建并随包发布 — 无需额外依赖或 `npm install`。
> 如果已全局安装，也可以使用 `learn-anything serve`。

仪表盘提供：

- **知识图谱** — Markdown 渲染的学习主题总览
- **学习笔记** — 按知识域分类浏览所有学习会话笔记
- **练习预览** — 带语法高亮查看起始代码、参考解答和练习记录
- **暗色模式** — 明/暗主题切换
- **国际化** — 完整的中英文界面
- **热更新** — 添加或修改主题文件时自动刷新浏览器

## 工作原理

```
你的项目/
├── .claude/
│   ├── commands/learn/          # Claude 专用斜杠命令
│   └── skills/                  # 包含完整工作流指令的 skill 文件
├── .cursor/commands/            # Cursor 专用命令格式
├── .gemini/commands/learn/      # Gemini TOML 格式命令
├── .codex/prompts/              # Codex prompt 文件
│   ...                          # （30+ 种工具各有对应格式）
│
├── .learn/                      # 🧠 你的学习数据存在这里
│   └── topics/
│       └── typescript/
│           ├── state.json           # 唯一数据源
│           ├── knowledge-map.md     # 由 state.json 自动渲染
│           ├── sessions/            # 会话历史，用于间隔重复
│           ├── exercises/           # TDD 风格编码练习
│           └── quizzes/             # 可复用的文字问答题库
└── ...
```

每个 AI 工具通过**适配器模式**获得对应格式的文件——Claude 用 YAML frontmatter，Gemini 用 TOML，Cursor 用 Markdown 等。

## 仓库结构

```
learn-anything/
├── packages/
│   ├── cli/                     # learn-anything-cli — 发布到 npm
│   │   ├── site/                 # 仪表盘源码 (Vue 3 + Vite)
│   │   ├── scripts/              # 构建脚本 (bundle-site.mjs)
│   │   ├── src/
│   │   │   ├── cli/             # Commander.js CLI 入口
│   │   │   ├── core/            # 初始化、配置、命令生成、模板
│   │   │   ├── i18n/            # en + zh-CN 多语言
│   │   │   └── utils/           # 文件系统、交互式帮助函数
│   │   ├── bin/                 # learn-anything 可执行文件
│   │   └── package.json
│   └── gui/                     # learn-anything-gui — 开发中 🚧
│       └── README.md
├── pnpm-workspace.yaml          # pnpm workspace 配置
├── tsconfig.base.json           # 共享 TypeScript 编译选项
├── package.json                 # 工作区根配置（私有）
└── pnpm-lock.yaml
```

| 包                                     | npm                                                                                                                    | 说明                                             |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| [`learn-anything-cli`](./packages/cli) | [![npm](https://img.shields.io/npm/v/learn-anything-cli?color=blue)](https://www.npmjs.com/package/learn-anything-cli) | CLI 工具 — 为 30+ AI 工具生成 skill/command 文件 |
| `learn-anything-gui`                   | _私有_                                                                                                                 | 图形化桌面界面 _(开发中)_                        |

## 支持的 AI 工具

> Manage、Amazon Q Developer、Antigravity、Auggie、Bob Shell、Claude Code、Cline、Codex、ForgeCode、CodeBuddy Code、Continue、CoStrict、Crush、Cursor、Factory Droid、Gemini CLI、GitHub Copilot、iFlow、Junie、Kilo Code、Kiro、OpenCode、Pi、Qoder、Lingma、Qwen Code、RooCode、Trae、Windsurf 及兼容 AGENTS.md 的助手。

```bash
# 更新已有 skill 文件到最新版本（自动检测已安装的工具）
npx learn-anything-cli update
```

## 开发

### 前置条件

- **Node.js** ≥ 20
- **pnpm** ≥ 9

### 环境搭建

```bash
git clone https://github.com/ChenChenyaqi/learn-anything.git
cd learn-anything
pnpm install
```

### 常用命令

| 命令              | 说明                          |
| :---------------- | :---------------------------- |
| `pnpm build`      | 构建所有包 (`tsc`)            |
| `pnpm test`       | 运行所有测试 (`vitest run`)   |
| `pnpm test:watch` | 监听模式运行测试              |
| `pnpm dev`        | TypeScript 监听模式（所有包） |
| `pnpm lint`       | 代码检查 (`eslint`)           |
| `pnpm format`     | 格式化代码 (`prettier`)       |
| `pnpm dev:site`   | 可视化仪表盘开发服务器        |

### 单独包命令

```bash
pnpm -F learn-anything-cli build      # 仅构建 CLI
pnpm -F learn-anything-cli test       # 仅测试 CLI
pnpm -F learn-anything-cli dev:cli    # 构建并在本地运行 CLI
```

## Star History

<a href="https://star-history.dera.page/#ChenChenyaqi/learn-anything&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=ChenChenyaqi/learn-anything&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=ChenChenyaqi/learn-anything&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=ChenChenyaqi/learn-anything&type=date&legend=top-left" />
  </picture>
</a>

## 许可证

[MIT](./LICENSE) © [yaqi chen](https://github.com/ChenChenyaqi)

---

<p align="center">
  <sub>用 ❤️ 为好奇心构建 · <a href="https://github.com/ChenChenyaqi/learn-anything">GitHub</a> · <a href="./CONTRIBUTING.md">贡献指南</a> · <a href="./CHANGELOG.md">更新日志</a></sub>
</p>
