import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relativeTime } from '@/components/agent-chat/time';

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
  });

  const nowSec = () => Math.floor(NOW / 1000);

  it('returns "just now" for less than a minute', () => {
    expect(relativeTime(nowSec() - 30)).toBe('just now');
    expect(relativeTime(nowSec())).toBe('just now');
  });

  it('returns "Xm ago" for minutes', () => {
    expect(relativeTime(nowSec() - 60)).toBe('1m ago');
    expect(relativeTime(nowSec() - 300)).toBe('5m ago');
    expect(relativeTime(nowSec() - 3599)).toBe('59m ago');
  });

  it('returns "Xh ago" for hours', () => {
    expect(relativeTime(nowSec() - 3600)).toBe('1h ago');
    expect(relativeTime(nowSec() - 10800)).toBe('3h ago');
    expect(relativeTime(nowSec() - 86399)).toBe('23h ago');
  });

  it('returns "Xd ago" for days within a week', () => {
    expect(relativeTime(nowSec() - 86400)).toBe('1d ago');
    expect(relativeTime(nowSec() - 172800)).toBe('2d ago');
    expect(relativeTime(nowSec() - 604799)).toBe('6d ago');
  });

  it('falls back to YYYY-MM-DD beyond a week', () => {
    expect(relativeTime(nowSec() - 604800)).toBe('2025-06-08');
    expect(relativeTime(nowSec() - 86400 * 30)).toBe('2025-05-16');
  });

  it('formats single-digit months and days with leading zeros', () => {
    const jan = new Date('2025-01-05T00:00:00').getTime();
    expect(relativeTime(Math.floor(jan / 1000))).toBe('2025-01-05');
  });
});
