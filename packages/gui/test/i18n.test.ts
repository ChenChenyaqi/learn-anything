import { describe, expect, it } from 'vitest';
import { resolveLocale } from '@/i18n/resolve';
import en from '@/i18n/locales/en';
import zhCN from '@/i18n/locales/zh-CN';

describe('resolveLocale', () => {
  it('maps plain language tags', () => {
    expect(resolveLocale(['zh'])).toBe('zh-CN');
    expect(resolveLocale(['en'])).toBe('en');
  });

  it('maps regional Chinese variants to zh-CN', () => {
    expect(resolveLocale(['zh-CN'])).toBe('zh-CN');
    expect(resolveLocale(['zh-cn'])).toBe('zh-CN');
    expect(resolveLocale(['zh_TW'])).toBe('zh-CN');
    expect(resolveLocale(['zh-Hans-CN'])).toBe('zh-CN');
    expect(resolveLocale(['zh-Hant-TW'])).toBe('zh-CN');
  });

  it('maps regional English variants to en', () => {
    expect(resolveLocale(['en-US'])).toBe('en');
    expect(resolveLocale(['en-GB'])).toBe('en');
  });

  it('skips unsupported tags and uses the first supported one', () => {
    expect(resolveLocale(['fr', 'zh-Hans-CN', 'en-US'])).toBe('zh-CN');
    expect(resolveLocale(['ja', 'de', 'en-US'])).toBe('en');
  });

  it('falls back to English for an empty or fully unsupported list', () => {
    expect(resolveLocale([])).toBe('en');
    expect(resolveLocale(['fr', 'ja'])).toBe('en');
  });
});

describe('locale message parity', () => {
  /** Collect the full dotted key set of a nested message object. */
  function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      return v && typeof v === 'object' ? keyPaths(v as Record<string, unknown>, path) : [path];
    });
  }

  it('zh-CN defines exactly the same keys as en (no missing, no extra)', () => {
    const enKeys = keyPaths(en).sort();
    const zhKeys = keyPaths(zhCN).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it('every message is a non-empty string', () => {
    for (const root of [en, zhCN]) {
      for (const path of keyPaths(root)) {
        const value = path
          .split('.')
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], root);
        expect(typeof value).toBe('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    }
  });
});
