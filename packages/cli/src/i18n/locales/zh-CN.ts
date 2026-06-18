import type { LocaleMessages } from '../types.js';

export const zhCN: LocaleMessages = {
  cli: {
    programDescription:
      'AI-powered recursive learning system with Socratic method and TDD practice',
    initCommandDescription: '在当前项目初始化 Learn Anything 学习技能',
    updateCommandDescription: '更新 Learn Anything 技能文件到最新版本',
    toolsOptionDescription: (ids: string) =>
      `指定 AI 工具（非交互模式）。使用 "all"、"none"，或逗号分隔的工具列表：${ids}`,
    notDirectory: (path: string) => `路径 "${path}" 不是一个目录`,
    dirNotExist: (path: string) => `目录 "${path}" 不存在，将自动创建。`,
    cannotAccess: (path: string, msg: string) => `无法访问路径 "${path}": ${msg}`,
    errorPrefix: (msg: string) => `错误: ${msg}`,
    updateComplete: 'Learn Anything 技能文件已更新。',
    forceOption: '跳过确认提示',
    langOption: '界面语言：zh-CN 或 en（默认读取系统语言设置）',
    portOption: '开发服务器端口（默认：24278）',
    noOpenOption: '不自动打开浏览器',
    serveCommandDescription: '启动本地站点以可视化学习进度',
    serveHint: '运行 npx learn-anything serve 在浏览器中查看学习进度',
  },

  init: {
    header: '\n🧠 Learn Anything — AI 驱动的递归学习系统\n',
    noToolsSelected: '未选择任何 AI 工具。使用 --tools 参数指定，或在交互模式中选择。',
    availableTools: (tools: string) => `可用的工具：${tools}`,
    skillGenerated: (toolName: string) => `  ✓ ${toolName} — 5 个技能文件已生成`,
    initComplete: '🎉 Learn Anything 初始化完成！\n',
    globalDataPath: (dir: string) => `  学习数据存储在 ${dir}/`,
    startLearning: (example: string) => `  运行 ${example} 开始你的第一个学习主题\n`,
    availableCommands: '可用的学习命令：',
    cmdLine: (cmd: string, desc: string) => `  ${cmd}${desc}`,
    interactiveSelectPrompt: '选择要生成技能的 AI 工具（空格选择，回车确认）：',
    migrationComplete: (count: number) => `已迁移 ${count} 个主题从 v0 到 v1 格式（已创建备份）。`,
    context7Prompt: '是否启用 Context7 进行文档验证？（提供按需访问官方库文档的能力）',
    context7Enabled: '  📚 已启用 Context7 文档验证引导。',
    context7SetupHint:
      '  💡 配置 Context7 MCP：运行 `npx ctx7 setup` 或访问 https://context7.com/docs/resources/all-clients',
  },

  serve: {
    startingServer: '正在启动服务器...',
    siteReady: (url: string) => `站点已就绪: ${url}`,
    portInUse: (port: number) => `端口 ${port} 已被占用。请使用 --port 选项指定其他端口。`,
    emptyTopics: '.learn/topics/ 中未找到学习主题。使用 /learn:topic 开始学习。',
    serverStopped: '服务器已停止。',
    siteNotBuilt: '未找到站点文件。请重新安装包或运行构建步骤。',
  },
};
