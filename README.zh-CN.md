# Learn Anything

AI 驱动的递归学习系统 — 将你的 AI 编程助手变成交互式导师，使用苏格拉底式教学法和 TDD 风格练习。

为 **30+ 种 AI 工具**（Claude Code、Cursor、Gemini CLI、Codex、Copilot、Windsurf 等）生成 skill 和 command 文件，通过斜杠命令系统性掌握任何技术主题。

## 快速开始

```bash
# 在项目中初始化（交互模式 — 选择你的 AI 工具）
npx learn-anything-cli init

# 直接指定工具
npx learn-anything-cli init --tools claude

# 中文终端输出
npx learn-anything-cli init --lang zh-CN

# 或者全局安装
npm install -g learn-anything-cli
learn-anything init
```

### Context7 集成（可选）

在执行 `init` 或 `update` 时，会提示是否启用 **Context7** 文档验证。启用后，AI 会获取官方文档并对照权威来源验证其教学内容——提高教学准确性。

如果你还没有配置 Context7，运行 `npx ctx7 setup` 或访问 [Context7 文档](https://context7.com/docs/resources/all-clients) 查看你使用的 AI 工具的配置方式。

初始化后，你的 AI 助手获得五个学习命令：

| 命令                             | 功能                                   |
| -------------------------------- | -------------------------------------- |
| `/learn:topic <topic-name>`      | 初始化主题，生成知识图谱，跟踪学习进度 |
| `/learn:explain <concept-name>`  | 递归式苏格拉底深度学习一个概念         |
| `/learn:practice <concept-name>` | TDD 风格编码练习，获得苏格拉底式反馈   |
| `/learn:review [topic-name]`     | 回顾学习进度，基于间隔重复推荐下一步   |
| `/learn:status [topic-name]`     | 可视化学习状态，展示知识图谱热力图     |

## 学习工作流

### `/learn:topic <topic-name>` — 初始化主题

AI 创建学习状态文件（`state.json`），并通过 `render.mjs` 生成知识图谱（`knowledge-map.md`），展示知识全景让你自主选择学习路径。

### `/learn:explain <concept-name>` — 递归式深度学习

AI 评估你的水平（初级 → 高级），用类比和代码示例讲解概念，识别更深层的子话题，让你自主决定深入程度。每次学习会话都会被记录用于间隔重复。

### `/learn:practice <concept-name>` — TDD 风格练习

AI 生成合适难度的测试驱动练习题（入门 / 进阶 / 挑战），提供结构化的苏格拉底式反馈，并更新你的掌握状态。涵盖边界情况、安全性和代码质量。

### `/learn:review [topic-name]` — 进度回顾

分析学习数据：掌握度热力图、间隔重复优先级评分、概念关系分析（阻塞概念 / 孤立概念）。生成个性化的下一步学习计划。

### `/learn:status [topic-name]` — 可视化状态

为每个概念渲染带状态图标、练习次数和信心分数的知识图谱热力图。

## 支持的 AI 工具

Manage、Amazon Q Developer、Antigravity、Auggie、Bob Shell、Claude Code、Cline、Codex、ForgeCode、CodeBuddy Code、Continue、CoStrict、Crush、Cursor、Factory Droid、Gemini CLI、GitHub Copilot、iFlow、Junie、Kilo Code、Kiro、OpenCode、Pi、Qoder、Lingma、Qwen Code、RooCode、Trae、Windsurf 及兼容 AGENTS.md 的助手。

```bash
# 更新技能文件到最新版本（自动检测已有工具目录）
npx learn-anything-cli update
```

## 工作原理

```
你的项目/
├── .claude/commands/learn/    # 斜杠命令（learn:topic、learn:explain...）
├── .claude/skills/            # 包含完整工作流指令的 skill 文件
├── .cursor/commands/          # Cursor 专用命令格式
├── .gemini/commands/learn/    # Gemini TOML 格式命令
├── .learn/                    # 你的学习数据（知识图谱、进度）
│   └── topics/
│       └── javascript/
│           ├── state.json          # 学习数据（唯一数据源）
│           ├── knowledge-map.md    # 由 render.mjs 从 state.json 自动生成
│           └── sessions/
└── ...
```

每个 AI 工具通过适配器模式获得对应格式的文件（Claude 用 YAML frontmatter，Gemini 用 TOML 等）。

## 开发

```bash
pnpm install
pnpm build        # 编译 TypeScript
pnpm test         # 运行测试
pnpm dev          # 监听模式
pnpm dev:cli      # 本地构建并运行 CLI
```

## 许可证

MIT
