import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setupScriptsDir, setupSkillFiles } from '../src/learn-skills/index.ts';
import { ALL_SCRIPT_NAMES, getSkillTemplateEntries } from '@learn-anything/shared';

function mtimeMs(p: string): number {
  return statSync(p).mtimeMs;
}

describe('learn-skills caching (writeIfChanged)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'learn-skills-test-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  let scriptsDir: string;

  it('first call: writes all script and skill files', () => {
    scriptsDir = setupScriptsDir(tmp);
    setupSkillFiles(tmp, scriptsDir);

    for (const name of ALL_SCRIPT_NAMES) {
      const f = join(scriptsDir, `${name}.mjs`);
      expect(existsSync(f), `script ${name}.mjs should exist`).toBe(true);
      expect(readFileSync(f, 'utf8').length).toBeGreaterThan(0);
    }

    const entries = getSkillTemplateEntries();
    const skillsDir = join(tmp, 'skills');
    for (const entry of entries) {
      const f = join(skillsDir, entry.dirName, 'SKILL.md');
      expect(existsSync(f), `skill ${entry.dirName}/SKILL.md should exist`).toBe(true);
      expect(readFileSync(f, 'utf8').length).toBeGreaterThan(0);
    }

    const findDocs = join(skillsDir, 'find-docs', 'SKILL.md');
    expect(existsSync(findDocs), 'find-docs/SKILL.md should exist').toBe(true);
    expect(readFileSync(findDocs, 'utf8').length).toBeGreaterThan(0);
  });

  it('second call: skips all writes (mtimes unchanged)', () => {
    const beforeScripts: number[] = [];
    for (const name of ALL_SCRIPT_NAMES) {
      beforeScripts.push(mtimeMs(join(scriptsDir, `${name}.mjs`)));
    }

    const skillsDir = join(tmp, 'skills');
    const entries = getSkillTemplateEntries();
    const beforeSkills: number[] = [];
    for (const entry of entries) {
      beforeSkills.push(mtimeMs(join(skillsDir, entry.dirName, 'SKILL.md')));
    }
    const beforeFindDocs = mtimeMs(join(skillsDir, 'find-docs', 'SKILL.md'));

    // second run
    setupScriptsDir(tmp);
    setupSkillFiles(tmp, scriptsDir);

    for (let i = 0; i < ALL_SCRIPT_NAMES.length; i++) {
      expect(mtimeMs(join(scriptsDir, `${ALL_SCRIPT_NAMES[i]}.mjs`))).toBe(beforeScripts[i]);
    }
    const entries2 = getSkillTemplateEntries();
    for (let i = 0; i < entries2.length; i++) {
      expect(mtimeMs(join(skillsDir, entries2[i].dirName, 'SKILL.md'))).toBe(beforeSkills[i]);
    }
    expect(mtimeMs(join(skillsDir, 'find-docs', 'SKILL.md'))).toBe(beforeFindDocs);
  });

  it('third call after deleting one file: only the deleted file is recreated', () => {
    const skillsDir = join(tmp, 'skills');
    const entry = getSkillTemplateEntries()[0];
    const deletedSkillFile = join(skillsDir, entry.dirName, 'SKILL.md');
    rmSync(deletedSkillFile);

    const beforeScript = mtimeMs(join(scriptsDir, `${ALL_SCRIPT_NAMES[0]}.mjs`));

    setupScriptsDir(tmp);
    setupSkillFiles(tmp, scriptsDir);

    expect(existsSync(deletedSkillFile), 'deleted skill file should be recreated').toBe(true);
    expect(mtimeMs(join(scriptsDir, `${ALL_SCRIPT_NAMES[0]}.mjs`))).toBe(beforeScript);
  });
});
