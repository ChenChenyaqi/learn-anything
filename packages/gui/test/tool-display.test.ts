import { describe, it, expect } from 'vitest';
import { summarizeToolCall } from '@/components/agent-chat/tool-display';

describe('summarizeToolCall', () => {
  /* ---- bash ----------------------------------------------------------- */
  it('bash: short single-line', () => {
    const r = summarizeToolCall('bash', { command: 'ls -la' });
    expect(r.summary).toBe('$ ls -la');
    expect(r.body).toBeUndefined();
  });

  it('bash: multi-line → body', () => {
    const r = summarizeToolCall('bash', { command: 'line1\nline2' });
    expect(r.summary).toBe('$ (command)');
    expect(r.body).toEqual({ content: 'line1\nline2' });
  });

  it('bash: very long → body', () => {
    const long = 'x'.repeat(121);
    const r = summarizeToolCall('bash', { command: long });
    expect(r.summary).toBe('$ (command)');
    expect(r.body).toEqual({ content: long });
  });

  /* ---- read ----------------------------------------------------------- */
  it('read: path only', () => {
    expect(summarizeToolCall('read', { path: 'src/foo.ts' }).summary).toBe('cat src/foo.ts');
  });

  it('read: path + offset + limit', () => {
    const r = summarizeToolCall('read', { path: 'f', offset: 10, limit: 50 });
    expect(r.summary).toBe('cat f  (offset 10, limit 50)');
  });

  /* ---- write ---------------------------------------------------------- */
  it('write: path + content', () => {
    const r = summarizeToolCall('write', { path: 'x.ts', content: 'hello' });
    expect(r.summary).toBe('write x.ts');
    expect(r.body).toEqual({ content: 'hello' });
  });

  it('write: empty content → no body', () => {
    const r = summarizeToolCall('write', { path: 'x.ts', content: '' });
    expect(r.summary).toBe('write x.ts');
    expect(r.body).toBeUndefined();
  });

  /* ---- edit ----------------------------------------------------------- */
  it('edit: path + edits', () => {
    const r = summarizeToolCall('edit', {
      path: 'x.ts',
      edits: [
        { oldText: 'a', newText: 'b' },
        { oldText: 'c', newText: 'd' },
      ],
    });
    expect(r.summary).toBe('edit x.ts');
    expect(r.body!.content).toContain('--- edit 1 ---');
    expect(r.body!.content).toContain('- a\n+ b');
    expect(r.body!.content).toContain('--- edit 2 ---');
  });

  it('edit: empty edits → no body', () => {
    const r = summarizeToolCall('edit', { path: 'x.ts', edits: [] });
    expect(r.summary).toBe('edit x.ts');
    expect(r.body).toBeUndefined();
  });

  /* ---- grep ----------------------------------------------------------- */
  it('grep: all flags', () => {
    const r = summarizeToolCall('grep', {
      pattern: 'foo',
      path: 'src/',
      ignoreCase: true,
      literal: true,
      context: 3,
      glob: '*.ts',
    });
    expect(r.summary).toBe('grep -i -F -C 3 -g *.ts "foo" src/');
  });

  it('grep: minimal', () => {
    const r = summarizeToolCall('grep', { pattern: 'bar' });
    expect(r.summary).toBe('grep "bar" .');
  });

  /* ---- find ----------------------------------------------------------- */
  it('find: pattern + path', () => {
    expect(summarizeToolCall('find', { pattern: '*.ts', path: 'src/' }).summary).toBe(
      'fd "*.ts" src/',
    );
  });

  it('find: no path defaults to .', () => {
    expect(summarizeToolCall('find', { pattern: '*' }).summary).toBe('fd "*" .');
  });

  /* ---- ls ------------------------------------------------------------- */
  it('ls: with path', () => {
    expect(summarizeToolCall('ls', { path: 'src/' }).summary).toBe('ls src/');
  });

  it('ls: no path → .', () => {
    expect(summarizeToolCall('ls', {}).summary).toBe('ls .');
  });

  /* ---- unknown -------------------------------------------------------- */
  it('unknown: name + JSON body', () => {
    const r = summarizeToolCall('ghost', { foo: 1 });
    expect(r.summary).toBe('ghost');
    expect(r.body!.content).toContain('"foo"');
  });

  it('unknown: empty args → no body', () => {
    const r = summarizeToolCall('ghost', {});
    expect(r.summary).toBe('ghost');
    expect(r.body).toBeUndefined();
  });

  /* ---- defensive ------------------------------------------------------ */
  it('null args is safe', () => {
    const r = summarizeToolCall('bash', null);
    expect(r.summary).toBe('$ ');
    expect(r.body).toBeUndefined();
  });

  it('undefined args is safe', () => {
    expect(summarizeToolCall('ls', undefined).summary).toBe('ls .');
  });
});
