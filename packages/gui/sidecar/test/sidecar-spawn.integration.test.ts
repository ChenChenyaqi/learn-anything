import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SIDECAR_DIR = resolve(__dirname, '..');
const SIDECAR_DIST = resolve(SIDECAR_DIR, 'dist/sidecar.js');

const FAKE_HOME = mkdtempSync(join(tmpdir(), 'sidecar-test-'));
const FAKE_CWD = mkdtempSync(join(tmpdir(), 'sidecar-cwd-'));

const BOOT_FRAME = JSON.stringify({
  apiKey: 'sk-fake',
  provider: 'openai',
  baseUrl: null,
  model: 'gpt-4o',
  cwd: FAKE_CWD,
  appDataDir: FAKE_HOME,
});

interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function spawnAndFeed(frames: string[]): Promise<SpawnResult> {
  const child = spawn('node', [SIDECAR_DIST], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, HOME: FAKE_HOME },
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout!.on('data', (chunk) => stdoutChunks.push(chunk));
  child.stderr!.on('data', (chunk) => stderrChunks.push(chunk));

  for (const frame of frames) {
    child.stdin!.write(frame + '\n');
  }
  child.stdin!.end();

  return new Promise<SpawnResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('sidecar did not exit within 15s'));
    }, 15_000);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    });
  });
}

function parseLines(output: string): Record<string, unknown>[] {
  return output
    .trim()
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('sidecar integration spawn (3.9)', () => {
  beforeAll(() => {
    execSync('node build.mjs', { cwd: SIDECAR_DIR });
  }, 30_000);

  it('boots with a fake stdin frame and emits session_id on /new', async () => {
    const { exitCode, stdout, stderr } = await spawnAndFeed([
      BOOT_FRAME,
      JSON.stringify({ kind: 'slash_command', text: '/new' }),
    ]);

    expect(stderr).not.toMatch(/fatal|rejected/i);
    const lines = parseLines(stdout);

    expect(exitCode).toBe(0);
    expect(lines.some((l) => l.type === 'session_id')).toBe(true);
  }, 20_000);

  afterAll(() => {
    rmSync(FAKE_HOME, { recursive: true, force: true });
    rmSync(FAKE_CWD, { recursive: true, force: true });
  });
});
