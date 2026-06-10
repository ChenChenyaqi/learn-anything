import type { CommandContent } from '@learn-anything/core';
export type { CommandContent } from '@learn-anything/core';

export interface ToolCommandAdapter {
  toolId: string;
  getFilePath(commandId: string): string;
  formatFile(content: CommandContent): string;
}

export interface GeneratedCommand {
  path: string;
  fileContent: string;
}
