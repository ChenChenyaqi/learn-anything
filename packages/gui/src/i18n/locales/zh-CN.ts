/* Simplified Chinese messages. Must mirror `en.ts` key-for-key — enforced
 * both at compile time (the `MessageSchema` annotation below) and at runtime
 * (the parity unit test in `test/i18n.test.ts`). */

import type { MessageSchema } from './en';

const zhCN: MessageSchema = {
  common: {
    loading: '加载中…',
    retry: '重试',
    back: '返回',
    save: '保存',
    saving: '保存中…',
    fileNotFound: '未找到文件。',
  },
  setup: {
    language: '语言',
    languageSystem: '跟随系统',
  },
};

export default zhCN;
