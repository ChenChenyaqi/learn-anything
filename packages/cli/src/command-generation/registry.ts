import type { ToolCommandAdapter } from './types.js';
import { claudeAdapter, cursorAdapter, codexAdapter, geminiAdapter } from './adapters/index.js';

export class CommandAdapterRegistry {
  private static adapters: Map<string, ToolCommandAdapter> = new Map();

  static {
    const all = [claudeAdapter, cursorAdapter, codexAdapter, geminiAdapter];
    for (const adapter of all) {
      CommandAdapterRegistry.adapters.set(adapter.toolId, adapter);
    }
  }

  static get(toolId: string): ToolCommandAdapter | undefined {
    return CommandAdapterRegistry.adapters.get(toolId);
  }

  static has(toolId: string): boolean {
    return CommandAdapterRegistry.adapters.has(toolId);
  }

  static getAll(): ToolCommandAdapter[] {
    return Array.from(CommandAdapterRegistry.adapters.values());
  }
}
