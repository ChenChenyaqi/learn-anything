export type SupportedLocale = 'zh-CN' | 'en';

export interface CLIMessages {
  programDescription: string;
  initCommandDescription: string;
  updateCommandDescription: string;
  toolsOptionDescription: (ids: string) => string;
  notDirectory: (path: string) => string;
  dirNotExist: (path: string) => string;
  cannotAccess: (path: string, msg: string) => string;
  errorPrefix: (msg: string) => string;
  updateComplete: string;
  forceOption: string;
  langOption: string;
}

export interface InitMessages {
  header: string;
  noToolsSelected: string;
  availableTools: (tools: string) => string;
  skillGenerated: (toolName: string) => string;
  initComplete: string;
  globalDataPath: (dir: string) => string;
  startLearning: (example: string) => string;
  availableCommands: string;
  cmdLine: (cmd: string, desc: string) => string;
  interactiveSelectPrompt: string;
}

export interface LocaleMessages {
  cli: CLIMessages;
  init: InitMessages;
}
