export type SupportedLocale = 'zh-CN' | 'en';

export interface ServeMessages {
  startingServer: string;
  siteReady: (url: string) => string;
  portInUse: (port: number) => string;
  emptyTopics: string;
  serverStopped: string;
  siteNotBuilt: string;
}

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
  portOption: string;
  noOpenOption: string;
  serveCommandDescription: string;
  serveHint: string;
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
  migrationComplete: (count: number) => string;
  context7Prompt: string;
  context7Enabled: string;
  context7SetupHint: string;
}

export interface LocaleMessages {
  cli: CLIMessages;
  init: InitMessages;
  serve: ServeMessages;
}
