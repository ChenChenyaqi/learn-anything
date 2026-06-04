import { describe, it, expect } from 'vitest';
import {
  getLearnTopicSkillTemplate,
  getLearnExplainSkillTemplate,
  getLearnPracticeSkillTemplate,
  getLearnReviewSkillTemplate,
  getLearnStatusSkillTemplate,
} from '../src/core/templates/skill-templates.js';
import {
  getSkillTemplates,
  getCommandTemplates,
  getCommandContents,
  generateSkillContent,
} from '../src/core/shared/skill-generation.js';
import { CommandAdapterRegistry } from '../src/core/command-generation/registry.js';
import { generateCommand, generateCommands } from '../src/core/command-generation/generator.js';

describe('Skill Templates', () => {
  it('should return 5 skill templates with required fields', () => {
    const templates = getSkillTemplates();
    expect(templates).toHaveLength(5);

    for (const entry of templates) {
      expect(entry.template.name).toBeTruthy();
      expect(entry.template.description).toBeTruthy();
      expect(entry.template.instructions).toBeTruthy();
      expect(entry.template.instructions.length).toBeGreaterThan(100);
      expect(entry.dirName).toBeTruthy();
      expect(entry.workflowId).toBeTruthy();
    }
  });

  it('should have unique workflow IDs', () => {
    const templates = getSkillTemplates();
    const ids = templates.map((t) => t.workflowId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should generate valid SKILL.md content with YAML frontmatter', () => {
    const template = getLearnExplainSkillTemplate();
    const content = generateSkillContent(template, '0.1.0');

    expect(content).toContain('---');
    expect(content).toContain('name: learn-anything-explain');
    expect(content).toContain('generatedBy: "0.1.0"');
    expect(content).toContain('Learn Anything');
  });

  it('should generate English SKILL.md content', () => {
    const template = getLearnExplainSkillTemplate();
    const content = generateSkillContent(template, '0.1.0');

    expect(content).toContain('---');
    expect(content).toContain('name: learn-anything-explain');
    expect(content).toContain('You are Learn Anything');
  });

  it('should use English name and description', () => {
    const template = getLearnExplainSkillTemplate();

    expect(template.name).toBe('learn-anything-explain');
    expect(template.description).toContain('Recursively deep-dive');
    expect(template.instructions).toContain('You are Learn Anything');
  });
});

describe('Command Templates', () => {
  it('should return 5 command templates', () => {
    const templates = getCommandTemplates();
    expect(templates).toHaveLength(5);
  });

  it('should generate CommandContent array', () => {
    const contents = getCommandContents();
    expect(contents).toHaveLength(5);
    for (const c of contents) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.category).toBe('Learning');
      expect(c.body).toBeTruthy();
    }
  });
});

describe('Command Generation', () => {
  it('should generate Claude Code command files correctly', () => {
    const adapter = CommandAdapterRegistry.get('claude');
    expect(adapter).toBeDefined();

    const contents = getCommandContents();
    const cmds = generateCommands(contents, adapter!);
    expect(cmds).toHaveLength(5);

    for (const cmd of cmds) {
      expect(cmd.path.replace(/\\/g, '/')).toContain('.claude/commands/learn/');
      expect(cmd.path).toMatch(/\.md$/);
      expect(cmd.fileContent).toContain('---');
      expect(cmd.fileContent).toContain('category: Learning');
    }
  });

  it('should generate Cursor command files correctly', () => {
    const adapter = CommandAdapterRegistry.get('cursor');
    expect(adapter).toBeDefined();

    const topicContent = getCommandContents()[0];
    const cmd = generateCommand(topicContent, adapter!);
    expect(cmd.path.replace(/\\/g, '/')).toContain('.cursor/commands/learn-anything-topic.md');
    expect(cmd.fileContent).toContain('/learn-anything-topic');
  });

  it('should generate Codex command files with absolute paths', () => {
    const adapter = CommandAdapterRegistry.get('codex');
    expect(adapter).toBeDefined();

    const topicContent = getCommandContents()[0];
    const cmd = generateCommand(topicContent, adapter!);
    expect(cmd.path.replace(/\\/g, '/')).toContain('.codex/prompts/learn-anything-topic.md');
  });

  it('should generate Gemini command files in TOML format', () => {
    const adapter = CommandAdapterRegistry.get('gemini');
    expect(adapter).toBeDefined();

    const topicContent = getCommandContents()[0];
    const cmd = generateCommand(topicContent, adapter!);
    expect(cmd.path.replace(/\\/g, '/')).toContain('.gemini/commands/learn/');
    expect(cmd.path).toMatch(/\.toml$/);
    expect(cmd.fileContent).toContain('description =');
    expect(cmd.fileContent).toContain('prompt = """');
  });
});

describe('Skill Template Content Quality', () => {
  it('explain template should include Socratic guidance', () => {
    const t = getLearnExplainSkillTemplate();
    expect(t.instructions).toContain('Socratic');
    expect(t.instructions).toContain('Recursive');
    expect(t.instructions).toContain('analogy');
    expect(t.instructions).toContain('./.learn/topics/');
  });

  it('practice template should include dual-mode guidance', () => {
    const t = getLearnPracticeSkillTemplate();
    expect(t.instructions).toContain('Project Mode');
    expect(t.instructions).toContain('Chat Mode');
    expect(t.instructions).toContain('Dynamic Difficulty');
    expect(t.instructions).toContain('Socratic Feedback');
    expect(t.instructions).toContain('Code Template');
  });

  it('topic template should include knowledge map generation', () => {
    const t = getLearnTopicSkillTemplate();
    expect(t.instructions).toContain('Knowledge Map');
    expect(t.instructions).toContain('knowledge-map.md');
    expect(t.instructions).toContain('state.yaml');
    expect(t.instructions).toContain('mkdir -p');
  });

  it('review template should include spaced repetition', () => {
    const t = getLearnReviewSkillTemplate();
    expect(t.instructions).toContain('spaced repetition');
    expect(t.instructions).toContain('priority = (1 - confidence)');
  });

  it('status template should include visualization', () => {
    const t = getLearnStatusSkillTemplate();
    expect(t.instructions).toContain('Heatmap');
    expect(t.instructions).toContain('✅');
    expect(t.instructions).toContain('Summary Panel');
  });
});
