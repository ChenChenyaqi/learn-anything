import type { CommandContent } from '@learn-anything/core';
import type { GeneratedCommand, ToolCommandAdapter } from './types.js';

export function generateCommand(
  content: CommandContent,
  adapter: ToolCommandAdapter,
): GeneratedCommand {
  return {
    path: adapter.getFilePath(content.id),
    fileContent: adapter.formatFile(content),
  };
}

export function generateCommands(
  contents: CommandContent[],
  adapter: ToolCommandAdapter,
): GeneratedCommand[] {
  return contents.map((content) => generateCommand(content, adapter));
}
