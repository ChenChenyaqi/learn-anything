import type { LocaleMessages } from '../types.js';

export const en: LocaleMessages = {
  cli: {
    programDescription:
      'AI-powered recursive learning system with Socratic method and TDD practice',
    initCommandDescription: 'Initialize Learn Anything learning skills in the current project',
    updateCommandDescription: 'Update Learn Anything skill files to latest version',
    toolsOptionDescription: (ids: string) =>
      `Specify AI tools (non-interactive mode). Use "all", "none", or comma-separated list: ${ids}`,
    notDirectory: (path: string) => `Path "${path}" is not a directory`,
    dirNotExist: (path: string) =>
      `Directory "${path}" does not exist, it will be created automatically.`,
    cannotAccess: (path: string, msg: string) => `Cannot access path "${path}": ${msg}`,
    errorPrefix: (msg: string) => `Error: ${msg}`,
    updateComplete: 'Learn Anything skill files have been updated.',
    forceOption: 'Skip confirmation prompt',
    langOption: 'Display language: zh-CN or en (default: system locale)',
  },

  init: {
    header: '\n🧠 Learn Anything — AI-Powered Recursive Learning System\n',
    noToolsSelected:
      'No AI tools selected. Use --tools option to specify, or select in interactive mode.',
    availableTools: (tools: string) => `Available tools: ${tools}`,
    skillGenerated: (toolName: string) => `  ✓ ${toolName} — 5 skill files generated`,
    initComplete: '🎉 Learn Anything initialization complete!\n',
    globalDataPath: (dir: string) => `  Learning data stored at ${dir}/`,
    startLearning: (example: string) => `  Run ${example} to start your first learning topic\n`,
    availableCommands: 'Available learning commands:',
    cmdLine: (cmd: string, desc: string) => `  ${cmd}${desc}`,
    interactiveSelectPrompt:
      'Select AI tools to generate skills for (space to select, enter to confirm):',
    migrationComplete: (count: number) =>
      `Migrated ${count} topic(s) from v0 to v1 format (backups created).`,
    context7Prompt:
      'Enable Context7 for documentation verification? (Provides on-demand access to official library docs)',
    context7Enabled: '  📚 Context7 guidance enabled.',
    context7SetupHint:
      '  💡 To set up Context7 MCP, run `npx ctx7 setup` or visit https://context7.com/docs/resources/all-clients',
  },
};
