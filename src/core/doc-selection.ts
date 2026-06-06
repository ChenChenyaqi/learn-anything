import type { SupportedLocale } from '../i18n/types.js';
import { getMessages } from '../i18n/index.js';
import { isInteractive } from '../utils/interactive.js';

/**
 * Interactively prompt the user for the local directory path
 * where documentation will be cached by the agent at runtime.
 *
 * In non-interactive mode, returns ".learn/docs".
 */
export async function promptDocStoragePath(locale: SupportedLocale): Promise<string> {
  const m = getMessages(locale).docSelection;

  if (!isInteractive()) {
    return '.learn/docs';
  }

  const { input } = await import('@inquirer/prompts');

  let storagePath = '';
  while (!storagePath) {
    const answer = await input({
      message: m.storagePath,
      validate: (value: string) => {
        if (!value.trim()) return m.storagePathRequired;
        return true;
      },
    });
    storagePath = answer.trim();
  }

  return storagePath;
}
