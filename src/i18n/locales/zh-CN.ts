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
  },
};
