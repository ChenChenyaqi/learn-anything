import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LEARN_DIR } from '../src/core/config.js';
import { InitCommand } from '../src/core/init.js';

describe('CLI Integration — init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-cli-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should not create .learn/site/ directory after init', async () => {
    const cmd = new InitCommand({ tools: 'none' });
    await cmd.execute(tmpDir);

    const sd = path.join(tmpDir, LEARN_DIR, 'site');
    expect(fs.existsSync(sd)).toBe(false);
  });

  it('should not affect existing .learn/ data after init', async () => {
    const topicsDir = path.join(tmpDir, LEARN_DIR, 'topics', 'python');
    fs.mkdirSync(topicsDir, { recursive: true });
    const statePath = path.join(topicsDir, 'state.json');
    fs.writeFileSync(statePath, '{"slug":"python"}', 'utf-8');

    const cmd = new InitCommand({ tools: 'none' });
    await cmd.execute(tmpDir);

    expect(fs.existsSync(statePath)).toBe(true);
    const sd = path.join(tmpDir, LEARN_DIR, 'site');
    expect(fs.existsSync(sd)).toBe(false);
  });
});
