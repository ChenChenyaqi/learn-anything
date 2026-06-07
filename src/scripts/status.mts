#!/usr/bin/env node
/**
 * status.mjs — standalone script
 * Reads state.json (v1) and outputs a formatted learning heatmap to stdout.
 *
 * Usage:
 *   node status.mjs <topic-dir>                    Detailed heatmap (English)
 *   node status.mjs --locale zh-CN <topic-dir>     Detailed heatmap (Chinese)
 *   node status.mjs --all [--locale zh-CN] <dir>   Summary of all topics
 *
 * This file is compiled from src/scripts/status.mts via tsc and
 * copied into learn-anything-status skill's scripts/ directory by init/update.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StateV1, Concept, ConceptStatus } from './utils.mjs';
import {
  validateStateV1,
  totalCount,
  masteredCount,
  STATUS_ICON,
} from './utils.mjs';

/* ------------------------------------------------------------------ */
/*  i18n                                                              */
/* ------------------------------------------------------------------ */

type Locale = 'en' | 'zh-CN';

interface Strings {
  // Single topic
  title: (topic: string) => string;
  mastered: string;
  active: string;
  practice: string;
  unexplored: string;
  progress: string;
  statsTitle: string;
  lastPractice: (name: string, rel: string) => string;
  startedLearning: (date: string) => string;
  daysLearning: (days: number) => string;
  legend: string;
  statusLabel: Record<ConceptStatus, string>;
  statusMeaning: Record<ConceptStatus, string>;
  practiceCount: (n: number) => string;
  confidence: (pct: number) => string;
  relativeToday: string;
  relativeYesterday: string;
  relativeDaysAgo: (n: number) => string;

  // All topics
  allTopicsTitle: string;
  topic: string;
  days: string;
  total: string;
  noTopics: string;
  startJourney: string;
  noData: (path: string) => string;
}

const EN: Strings = {
  title: (topic) => `🌟 ${topic} Learning Status`,
  mastered: 'Mastered',
  active: 'Active',
  practice: 'Practice',
  unexplored: 'Unexplored',
  progress: 'Progress',
  statsTitle: '📊 Learning Stats',
  lastPractice: (name, rel) => `💪 Last Practice: ${name} (${rel})`,
  startedLearning: (date) => `📅 Started Learning: ${date}`,
  daysLearning: (days) => `⏱️  Days Learning: ${days}`,
  legend: 'Legend',
  statusLabel: {
    mastered: 'mastered',
    in_progress: 'in progress',
    needs_practice: 'needs practice',
    unexplored: 'unexplored',
  },
  statusMeaning: {
    mastered: 'Mastered — passed practice, high confidence',
    in_progress: 'In Progress — started but not yet mastered',
    needs_practice: 'Needs Practice — understand but need reinforcement',
    unexplored: 'Unexplored — haven\'t started learning yet',
  },
  practiceCount: (n) => n === 1 ? '1 practice' : `${n} practices`,
  confidence: (pct) => `${pct}% confidence`,
  relativeToday: 'today',
  relativeYesterday: 'yesterday',
  relativeDaysAgo: (n) => `${n} days ago`,
  allTopicsTitle: '🌟 Learning Status — All Topics',
  topic: 'Topic',
  days: 'Days',
  total: 'Total',
  noTopics: '📭 No learning topics found.',
  startJourney: 'Run `/learn <topic-name>` to start your learning journey!',
  noData: (path) => `📭 No learning data found at ${path}`,
};

const ZH_CN: Strings = {
  title: (topic) => `🌟 ${topic} 学习状态`,
  mastered: '已掌握',
  active: '进行中',
  practice: '需练习',
  unexplored: '未探索',
  progress: '进度',
  statsTitle: '📊 学习统计',
  lastPractice: (name, rel) => `💪 最近练习: ${name} (${rel})`,
  startedLearning: (date) => `📅 开始学习: ${date}`,
  daysLearning: (days) => `⏱️  学习天数: ${days}`,
  legend: '图例',
  statusLabel: {
    mastered: '已掌握',
    in_progress: '进行中',
    needs_practice: '需练习',
    unexplored: '未探索',
  },
  statusMeaning: {
    mastered: '已掌握 — 通过练习，掌握度高',
    in_progress: '进行中 — 已开始但尚未掌握',
    needs_practice: '需练习 — 理解但需要巩固',
    unexplored: '未探索 — 尚未开始学习',
  },
  practiceCount: (n) => n === 1 ? '1 次练习' : `${n} 次练习`,
  confidence: (pct) => `${pct}% 掌握度`,
  relativeToday: '今天',
  relativeYesterday: '昨天',
  relativeDaysAgo: (n) => `${n} 天前`,
  allTopicsTitle: '🌟 学习状态 — 所有主题',
  topic: '主题',
  days: '天数',
  total: '合计',
  noTopics: '📭 暂无学习主题。',
  startJourney: '运行 `/learn <主题名>` 开始你的学习之旅！',
  noData: (path) => `📭 未找到学习数据: ${path}`,
};

const STRINGS: Record<Locale, Strings> = { en: EN, 'zh-CN': ZH_CN };

/* ------------------------------------------------------------------ */
/*  Display width helpers                                             */
/* ------------------------------------------------------------------ */

function dw(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    w += cp > 0xffff || isCJK(cp) ? 2 : 1;
  }
  return w;
}

/** Check if a code point is a CJK / fullwidth character (display width = 2). */
function isCJK(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff)   // CJK Unified Ideographs
    || (cp >= 0x3400 && cp <= 0x4dbf) // CJK Extension A
    || (cp >= 0xf900 && cp <= 0xfaff) // CJK Compatibility Ideographs
    || (cp >= 0x2e80 && cp <= 0x2eff) // CJK Radicals Supplement
    || (cp >= 0x3000 && cp <= 0x303f) // CJK Symbols and Punctuation
    || (cp >= 0x3040 && cp <= 0x309f) // Hiragana
    || (cp >= 0x30a0 && cp <= 0x30ff) // Katakana
    || (cp >= 0xff01 && cp <= 0xff60) // Fullwidth Forms
    || (cp >= 0xac00 && cp <= 0xd7af) // Hangul Syllables
  );
}

function padEnd(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - dw(s)));
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */

function countByStatus(state: StateV1, status: ConceptStatus): number {
  return state.domains.reduce(
    (sum, d) => sum + d.concepts.filter((c) => c.status === status).length,
    0,
  );
}

function relativeDate(dateStr: string, t: Strings, now = Date.now()): string {
  const then = new Date(dateStr.replace(' ', 'T')).getTime();
  const days = Math.floor((now - then) / 86400000);
  if (days <= 0) return t.relativeToday;
  if (days === 1) return t.relativeYesterday;
  return t.relativeDaysAgo(days);
}

function daysBetween(dateStr: string, now = Date.now()): number {
  const then = new Date(dateStr.replace(' ', 'T')).getTime();
  return Math.max(1, Math.floor((now - then) / 86400000));
}

function readStateJson(filePath: string): StateV1 {
  const raw = readFileSync(filePath, 'utf-8');
  const data: unknown = JSON.parse(raw);
  const errors = validateStateV1(data);
  if (errors.length > 0) {
    throw new Error(
      `state.json validation failed:\n${errors.map((e) => `  .${e.path}: ${e.message}`).join('\n')}`,
    );
  }
  return data as unknown as StateV1;
}

/* ------------------------------------------------------------------ */
/*  Single topic — detailed heatmap                                   */
/* ------------------------------------------------------------------ */

function findLastPracticed(state: StateV1): { name: string; date: string } | null {
  let best: { name: string; date: string } | null = null;
  for (const d of state.domains) {
    for (const c of d.concepts) {
      if (c.last_practiced && (!best || c.last_practiced > best.date)) {
        best = { name: c.name, date: c.last_practiced };
      }
    }
  }
  return best;
}

function conceptLine(concept: Concept, t: Strings): string {
  const icon = STATUS_ICON[concept.status];
  const label = t.statusLabel[concept.status];

  if (concept.status === 'unexplored') {
    return `${icon} ${concept.name}  ${label}`;
  }

  const parts: string[] = [label];
  if (concept.practice_count > 0) parts.push(t.practiceCount(concept.practice_count));
  if (concept.confidence > 0) parts.push(t.confidence(Math.round(concept.confidence * 100)));
  return `${icon} ${concept.name}  ${parts.join(' · ')}`;
}

export function renderStatus(state: StateV1, now?: number, locale: Locale = 'en'): string {
  const t = STRINGS[locale];
  const lines: string[] = [];

  const total = totalCount(state);
  const mastered = masteredCount(state);
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  // Title
  lines.push(t.title(state.topic));
  lines.push('');

  // Tree-structured heatmap
  for (const domain of state.domains) {
    if (domain.concepts.length === 0) continue;

    const domainMastered = domain.concepts.filter((c) => c.status === 'mastered').length;
    lines.push(`${domain.name}  [${domainMastered}/${domain.concepts.length} ${t.mastered.toLowerCase()}]`);

    const last = domain.concepts.length - 1;
    for (let i = 0; i <= last; i++) {
      const prefix = i === last ? '└──' : '├──';
      lines.push(`${prefix} ${conceptLine(domain.concepts[i], t)}`);
    }
    lines.push('');
  }

  // Summary panel — column widths based on locale
  const active = countByStatus(state, 'in_progress');
  const practice = countByStatus(state, 'needs_practice');
  const unexplored = countByStatus(state, 'unexplored');

  // Compute column widths to fit headers + data
  const colM = Math.max(dw(t.mastered) + 2, 10);
  const colA = Math.max(dw(t.active) + 2, 9);
  const colP = Math.max(dw(t.practice) + 2, 10);
  const colU = Math.max(dw(t.unexplored) + 2, 11);
  const colR = Math.max(dw(t.progress) + 2, 9);
  const totalW = 1 + colM + 1 + colA + 1 + colP + 1 + colU + 1 + colR + 1;

  const hLine = '─'.repeat(totalW - 2);
  lines.push(`┌${hLine}┐`);
  lines.push(`│${padEnd(`    ${t.statsTitle}`, totalW - 2)}│`);
  lines.push(`├${'─'.repeat(colM)}┬${'─'.repeat(colA)}┬${'─'.repeat(colP)}┬${'─'.repeat(colU)}┬${'─'.repeat(colR)}┤`);
  lines.push(`│${padEnd(` ${t.mastered}`, colM)}│${padEnd(` ${t.active}`, colA)}│${padEnd(` ${t.practice}`, colP)}│${padEnd(` ${t.unexplored}`, colU)}│${padEnd(` ${t.progress}`, colR)}│`);
  lines.push(`│${padEnd(` ${mastered} 🟢`, colM)}│${padEnd(` ${active} 🔵`, colA)}│${padEnd(` ${practice} 🟠`, colP)}│${padEnd(` ${unexplored} ⚪`, colU)}│${padEnd(` ${pct}%`, colR)}│`);
  lines.push(`├${'─'.repeat(colM)}┴${'─'.repeat(colA)}┴${'─'.repeat(colP)}┴${'─'.repeat(colU)}┴${'─'.repeat(colR)}┤`);

  const contentW = totalW - 2;
  const lastP = findLastPracticed(state);
  if (lastP) {
    const rel = relativeDate(lastP.date, t, now);
    lines.push(`│${padEnd(` ${t.lastPractice(lastP.name, rel)}`, contentW)}│`);
  }

  const started = state.created.split(' ')[0];
  lines.push(`│${padEnd(` ${t.startedLearning(started)}`, contentW)}│`);

  const days = daysBetween(state.created, now);
  lines.push(`│${padEnd(` ${t.daysLearning(days)}`, contentW)}│`);

  lines.push(`└${hLine}┘`);
  lines.push('');

  // Legend
  lines.push(`## ${t.legend}`);
  lines.push('');
  lines.push(`| Icon | Status | Meaning |`);
  lines.push(`|------|--------|---------|`);
  for (const status of ['mastered', 'in_progress', 'needs_practice', 'unexplored'] as ConceptStatus[]) {
    lines.push(`| ${STATUS_ICON[status]} | ${t.statusLabel[status]} | ${t.statusMeaning[status]} |`);
  }

  return lines.join('\n').trimEnd() + '\n';
}

/* ------------------------------------------------------------------ */
/*  All topics — summary by topic                                     */
/* ------------------------------------------------------------------ */

interface TopicSummary {
  topic: string;
  slug: string;
  total: number;
  mastered: number;
  active: number;
  practice: number;
  unexplored: number;
  pct: number;
  lastPracticed: string | null;
  days: number;
}

function scanTopics(baseDir: string): TopicSummary[] {
  const summaries: TopicSummary[] = [];

  let entries: string[];
  try {
    entries = readdirSync(baseDir);
  } catch {
    return summaries;
  }

  for (const name of entries) {
    const fullPath = join(baseDir, name);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const statePath = join(fullPath, 'state.json');
    try {
      const state = readStateJson(statePath);
      const total = totalCount(state);
      const mastered = masteredCount(state);

      let lastPracticed: string | null = null;
      for (const d of state.domains) {
        for (const c of d.concepts) {
          if (c.last_practiced && (!lastPracticed || c.last_practiced > lastPracticed)) {
            lastPracticed = c.last_practiced;
          }
        }
      }

      summaries.push({
        topic: state.topic,
        slug: state.slug,
        total,
        mastered,
        active: countByStatus(state, 'in_progress'),
        practice: countByStatus(state, 'needs_practice'),
        unexplored: countByStatus(state, 'unexplored'),
        pct: total > 0 ? Math.round((mastered / total) * 100) : 0,
        lastPracticed,
        days: daysBetween(state.created),
      });
    } catch {
      // Skip dirs without valid state.json
    }
  }

  return summaries;
}

export function renderAllTopics(summaries: TopicSummary[], now?: number, locale: Locale = 'en'): string {
  const t = STRINGS[locale];
  const lines: string[] = [];

  lines.push(t.allTopicsTitle);
  lines.push('');

  if (summaries.length === 0) {
    lines.push(t.noTopics);
    lines.push(t.startJourney);
    lines.push('');
    return lines.join('\n').trimEnd() + '\n';
  }

  // Compute column display widths
  const topicCol = Math.max(dw(t.topic) + 2, ...summaries.map((s) => dw(s.topic) + 2));
  const masterCol = Math.max(dw(t.mastered) + 2, 12);
  const activeCol = Math.max(dw(t.active) + 2, 8);
  const practiceCol = Math.max(dw(t.practice) + 2, 10);
  const progressCol = Math.max(dw(t.progress) + 2, 10);
  const daysCol = Math.max(dw(t.days) + 2, 8);

  const sep = `┼${'─'.repeat(topicCol)}┼${'─'.repeat(masterCol)}┼${'─'.repeat(activeCol)}┼${'─'.repeat(practiceCol)}┼${'─'.repeat(progressCol)}┼${'─'.repeat(daysCol)}┤`;
  const top = `┌${'─'.repeat(topicCol)}┬${'─'.repeat(masterCol)}┬${'─'.repeat(activeCol)}┬${'─'.repeat(practiceCol)}┬${'─'.repeat(progressCol)}┬${'─'.repeat(daysCol)}┐`;
  const bot = `└${'─'.repeat(topicCol)}┴${'─'.repeat(masterCol)}┴${'─'.repeat(activeCol)}┴${'─'.repeat(practiceCol)}┴${'─'.repeat(progressCol)}┴${'─'.repeat(daysCol)}┘`;

  lines.push(top);
  lines.push(`│ ${padEnd(t.topic, topicCol - 1)}│ ${padEnd(t.mastered, masterCol - 1)}│ ${padEnd(t.active, activeCol - 1)}│ ${padEnd(t.practice, practiceCol - 1)}│ ${padEnd(t.progress, progressCol - 1)}│ ${padEnd(t.days, daysCol - 1)}│`);
  lines.push(sep);

  for (const s of summaries) {
    lines.push(
      `│ ${padEnd(s.topic, topicCol - 1)}│ ${padEnd(`${s.mastered}/${s.total} 🟢`, masterCol - 1)}│ ${padEnd(`${s.active} 🔵`, activeCol - 1)}│ ${padEnd(`${s.practice} 🟠`, practiceCol - 1)}│ ${padEnd(`${s.pct}%`, progressCol - 1)}│ ${padEnd(`${s.days}`, daysCol - 1)}│`,
    );
  }

  // Overall totals
  const grandTotal = summaries.reduce((s, acc) => s + acc.total, 0);
  const grandMastered = summaries.reduce((s, acc) => s + acc.mastered, 0);
  const grandActive = summaries.reduce((s, acc) => s + acc.active, 0);
  const grandPractice = summaries.reduce((s, acc) => s + acc.practice, 0);
  const grandPct = grandTotal > 0 ? Math.round((grandMastered / grandTotal) * 100) : 0;

  lines.push(sep);
  lines.push(
    `│ ${padEnd(t.total, topicCol - 1)}│ ${padEnd(`${grandMastered}/${grandTotal} 🟢`, masterCol - 1)}│ ${padEnd(`${grandActive} 🔵`, activeCol - 1)}│ ${padEnd(`${grandPractice} 🟠`, practiceCol - 1)}│ ${padEnd(`${grandPct}%`, progressCol - 1)}│ ${padEnd('', daysCol - 1)}│`,
  );
  lines.push(bot);
  lines.push('');

  // Find latest practice across all topics
  let latestTopic = '';
  let latestDate: string | null = null;
  for (const s of summaries) {
    if (s.lastPracticed && (!latestDate || s.lastPracticed > latestDate)) {
      latestDate = s.lastPracticed;
      latestTopic = s.topic;
    }
  }

  if (latestDate) {
    lines.push(t.lastPractice(latestTopic, relativeDate(latestDate, t, now)));
  }

  lines.push('');

  // Legend
  lines.push(`## ${t.legend}`);
  lines.push('');
  lines.push(`| Icon | Status |`);
  lines.push(`|------|--------|`);
  for (const status of ['mastered', 'in_progress', 'needs_practice', 'unexplored'] as ConceptStatus[]) {
    lines.push(`| ${STATUS_ICON[status]} | ${t.statusLabel[status]} |`);
  }

  return lines.join('\n').trimEnd() + '\n';
}

/* ------------------------------------------------------------------ */
/*  CLI                                                               */
/* ------------------------------------------------------------------ */

function usage(): never {
  const script = process.argv[1]?.split('/').pop() || 'status.mjs';
  console.error(`Usage:`);
  console.error(`  node ${script} [--locale en|zh-CN] <topic-dir>`);
  console.error(`  node ${script} --all [--locale en|zh-CN] <topics-dir>`);
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
  }

  // Parse flags
  let locale: Locale = 'en';
  let isAll = false;
  let dirArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all') {
      isAll = true;
    } else if (args[i] === '--locale' && args[i + 1]) {
      const val = args[++i];
      if (val === 'en' || val === 'zh-CN') {
        locale = val;
      } else {
        console.error(`Unknown locale: ${val}. Supported: en, zh-CN`);
        process.exit(1);
      }
    } else if (!args[i].startsWith('--')) {
      dirArg = args[i];
    }
  }

  if (!dirArg) {
    usage();
  }

  const dir = resolve(dirArg);

  if (isAll) {
    const summaries = scanTopics(dir);
    console.log(renderAllTopics(summaries, undefined, locale));
  } else {
    const statePath = join(dir, 'state.json');

    let state: StateV1;
    try {
      state = readStateJson(statePath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT') || msg.includes('not found')) {
        const t = STRINGS[locale];
        console.error(t.noData(statePath));
        console.error(t.startJourney);
      } else {
        console.error(`Error: ${msg}`);
      }
      process.exit(1);
    }

    console.log(renderStatus(state, undefined, locale));
  }
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main();
}
