import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relativeTime } from '@/components/agent-chat/time';
import { i18n } from '@/i18n';

// relativeTime takes the translate function as a parameter; the tests use the
// real i18n instance so the resolved copy is asserted against actual locale
// messages (catches template/placeholder drift, not just boundary logic).

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const NOW = new Date('2025-06-15T12:00:00').getTime();

  beforeEach(() => {
    vi.setSystemTime(NOW);
    i18n.global.locale.value = 'en';
  });

  const nowSec = () => Math.floor(NOW / 1000);
  const t = i18n.global.t;

  it('returns "just now" for less than a minute', () => {
    expect(relativeTime(nowSec() - 30, t)).toBe('just now');
    expect(relativeTime(nowSec(), t)).toBe('just now');
  });

  it('returns "Xm ago" for minutes', () => {
    expect(relativeTime(nowSec() - 60, t)).toBe('1m ago');
    expect(relativeTime(nowSec() - 300, t)).toBe('5m ago');
    expect(relativeTime(nowSec() - 3599, t)).toBe('59m ago');
  });

  it('returns "Xh ago" for hours', () => {
    expect(relativeTime(nowSec() - 3600, t)).toBe('1h ago');
    expect(relativeTime(nowSec() - 10800, t)).toBe('3h ago');
    expect(relativeTime(nowSec() - 86399, t)).toBe('23h ago');
  });

  it('returns "Xd ago" for days within a week', () => {
    expect(relativeTime(nowSec() - 86400, t)).toBe('1d ago');
    expect(relativeTime(nowSec() - 172800, t)).toBe('2d ago');
    expect(relativeTime(nowSec() - 604799, t)).toBe('6d ago');
  });

  it('falls back to YYYY-MM-DD beyond a week', () => {
    expect(relativeTime(nowSec() - 604800, t)).toBe('2025-06-08');
    expect(relativeTime(nowSec() - 86400 * 30, t)).toBe('2025-05-16');
  });

  it('formats single-digit months and days with leading zeros', () => {
    const jan = new Date('2025-01-05T00:00:00').getTime();
    expect(relativeTime(Math.floor(jan / 1000), t)).toBe('2025-01-05');
  });

  it('formats the same boundaries in Chinese', () => {
    i18n.global.locale.value = 'zh-CN';
    expect(relativeTime(nowSec() - 30, t)).toBe('刚刚');
    expect(relativeTime(nowSec() - 300, t)).toBe('5 分钟前');
    expect(relativeTime(nowSec() - 10800, t)).toBe('3 小时前');
    expect(relativeTime(nowSec() - 172800, t)).toBe('2 天前');
    // Date fallback is locale-neutral by design.
    expect(relativeTime(nowSec() - 604800, t)).toBe('2025-06-08');
  });
});
