import path from 'path';
import chalk from 'chalk';
import * as fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { FileSystemUtils } from '../utils/file-system.js';
import { AI_TOOLS, AIToolOption, LEARN_DIR } from './config.js';
import { isInteractive } from '../utils/interactive.js';
import { generateCommands, CommandAdapterRegistry } from './command-generation/index.js';
import { getSkillTemplates, getCommandContents, generateSkillContent } from './shared/index.js';
import type { SupportedLocale } from '../i18n/types.js';
import { getMessages } from '../i18n/index.js';
import { CONTEXT7_GUIDANCE } from './templates/context7-guidance.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../../package.json');

type InitCommandOptions = {
  tools?: string;
  force?: boolean;
  locale?: SupportedLocale;
  update?: boolean;
  context7?: boolean;
};

export class InitCommand {
  private readonly toolsArg?: string;
  private readonly force: boolean;
  private readonly locale: SupportedLocale;
  private readonly isUpdate: boolean;
  private readonly context7Arg?: boolean;
  private context7Enabled: boolean = false;

  constructor(options: InitCommandOptions = {}) {
    this.toolsArg = options.tools;
    this.force = options.force ?? false;
    this.locale = options.locale ?? 'en';
    this.isUpdate = options.update ?? false;
    this.context7Arg = options.context7;
  }

  async execute(targetPath: string = '.'): Promise<void> {
    const resolvedPath = path.resolve(targetPath);
    const m = getMessages(this.locale);

    // Ensure target directory exists
    await FileSystemUtils.ensureDir(resolvedPath);

    // Create .learn/ directory in the target project
    const learnDir = path.join(resolvedPath, LEARN_DIR);
    const topicsDir = path.join(learnDir, 'topics');
    await FileSystemUtils.ensureDir(topicsDir);

    // Run v0→v1 migration for any existing learning data
    const { migrateAll } = await import('./learn-protocol/index.js');
    const report = await migrateAll(topicsDir);
    if (report.migratedCount > 0) {
      console.log(chalk.green(m.init.migrationComplete(report.migratedCount)));
    }

    console.log(chalk.bold(m.init.header));

    // Detect available tools
    const availableTools = await this.detectTools(resolvedPath);

    // Select tools
    let selectedTools: AIToolOption[];
    if (this.toolsArg === 'all') {
      selectedTools = availableTools.filter((t) => t.available);
    } else if (this.toolsArg === 'none') {
      selectedTools = [];
    } else if (this.toolsArg) {
      const toolIds = this.toolsArg.split(',').map((t) => t.trim());
      selectedTools = availableTools.filter((t) => toolIds.includes(t.value));
    } else if (this.isUpdate || !isInteractive()) {
      // Update mode or non-interactive: auto-detect existing tool dirs
      selectedTools = availableTools.filter((t) => t.available && this.hasToolDir(resolvedPath, t));
    } else {
      selectedTools = await this.interactiveSelect(availableTools);
    }

    if (selectedTools.length === 0) {
      console.log(chalk.yellow(m.init.noToolsSelected));
      console.log(
        chalk.dim(
          m.init.availableTools(
            availableTools
              .filter((t) => t.available)
              .map((t) => t.value)
              .join(', '),
          ),
        ),
      );
      return;
    }

    // Context7 setup
    this.context7Enabled = await this.promptContext7();
    if (this.context7Enabled) {
      console.log(chalk.dim(m.init.context7Enabled));
    }
    console.log('');

    // Generate skill files for each tool
    for (const tool of selectedTools) {
      if (!tool.skillsDir) continue;
      await this.generateSkillsForTool(resolvedPath, tool);
      await this.generateCommandsForTool(resolvedPath, tool);
      console.log(chalk.green(m.init.skillGenerated(tool.name)));
    }

    console.log('');
    console.log(chalk.bold(m.init.initComplete));
    console.log(chalk.dim(m.init.globalDataPath(LEARN_DIR)));
    console.log(chalk.dim(m.init.startLearning('/learn javascript')));

    console.log(chalk.bold(m.init.availableCommands));
    const cmd = m.init.cmdLine;
    console.log(
      cmd(
        chalk.cyan('/learn:topic <topic-name>'),
        chalk.dim('      — Initialize or load a learning topic'),
      ),
    );
    console.log(
      cmd(
        chalk.cyan('/learn:explain <concept-name>'),
        chalk.dim('  — Recursively deep-dive into a concept'),
      ),
    );
    console.log(
      cmd(chalk.cyan('/learn:practice <concept-name>'), chalk.dim(' — TDD-style coding exercises')),
    );
    console.log(
      cmd(
        chalk.cyan('/learn:review [topic-name]'),
        chalk.dim('    — Review progress, spaced repetition recommendations'),
      ),
    );
    console.log(
      cmd(
        chalk.cyan('/learn:status [topic-name]'),
        chalk.dim('    — Visualize learning state as knowledge map heatmap'),
      ),
    );
    console.log('');

    if (this.context7Enabled) {
      console.log(chalk.dim(m.init.context7SetupHint));
      console.log('');
    }
  }

  private async promptContext7(): Promise<boolean> {
    const m = getMessages(this.locale);

    if (this.context7Arg === true) return true;
    if (this.context7Arg === false) return false;

    if (!isInteractive()) return true;

    const { confirm } = await import('@inquirer/prompts');
    return confirm({ message: m.init.context7Prompt, default: true });
  }

  private async detectTools(_resolvedPath: string): Promise<AIToolOption[]> {
    return AI_TOOLS;
  }

  private hasToolDir(resolvedPath: string, tool: AIToolOption): boolean {
    if (!tool.skillsDir) return false;
    const dirPath = path.join(resolvedPath, tool.skillsDir);
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  private async interactiveSelect(tools: AIToolOption[]): Promise<AIToolOption[]> {
    const availableTools = tools.filter((t) => t.available && t.skillsDir);
    const { checkbox } = await import('@inquirer/prompts');

    // Auto-detect existing tool dirs and pre-select them
    const detected = availableTools.filter((t) => this.hasToolDir(process.cwd(), t));
    const detectedValues = new Set(detected.map((t) => t.value));

    const choices = availableTools.map((t) => ({
      name: t.name,
      value: t.value,
      checked: detectedValues.has(t.value),
    }));

    const selected = await checkbox({
      message: getMessages(this.locale).init.interactiveSelectPrompt,
      choices,
      pageSize: 15,
    });

    return availableTools.filter((t) => selected.includes(t.value));
  }

  private async generateSkillsForTool(resolvedPath: string, tool: AIToolOption): Promise<void> {
    const skillTemplates = getSkillTemplates();

    for (const entry of skillTemplates) {
      const skillDir = path.join(resolvedPath, tool.skillsDir!, 'skills', entry.dirName);
      const skillFile = path.join(skillDir, 'SKILL.md');
      const content = generateSkillContent(
        entry.template,
        VERSION,
        this.context7Enabled && isDocVerificationTemplate(entry.workflowId)
          ? injectContext7Guidance
          : undefined,
      );
      await FileSystemUtils.writeFile(skillFile, content);

      const scriptsDir = path.join(skillDir, 'scripts');

      // topic / explain / practice → utils.mjs + render.mjs
      if (
        entry.dirName === 'learn-anything-topic' ||
        entry.dirName === 'learn-anything-explain' ||
        entry.dirName === 'learn-anything-practice'
      ) {
        await FileSystemUtils.writeFile(
          path.join(scriptsDir, 'utils.mjs'),
          this.readCompiledScript('utils.mjs'),
        );
        await FileSystemUtils.writeFile(
          path.join(scriptsDir, 'render.mjs'),
          this.readCompiledScript('render.mjs'),
        );
      }

      // status → utils.mjs + status.mjs
      if (entry.dirName === 'learn-anything-status') {
        await FileSystemUtils.writeFile(
          path.join(scriptsDir, 'utils.mjs'),
          this.readCompiledScript('utils.mjs'),
        );
        await FileSystemUtils.writeFile(
          path.join(scriptsDir, 'status.mjs'),
          this.readCompiledScript('status.mjs'),
        );
      }

      // review → no scripts needed
    }
  }

  /** Read a compiled script from dist/scripts/ (bundled alongside this module). */
  private readCompiledScript(filename: string): string {
    const scriptPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'scripts',
      filename,
    );
    return fs.readFileSync(scriptPath, 'utf-8');
  }

  private async generateCommandsForTool(resolvedPath: string, tool: AIToolOption): Promise<void> {
    const adapter = CommandAdapterRegistry.get(tool.value);
    if (!adapter) return;

    const commandContents = getCommandContents();
    const generatedCommands = generateCommands(commandContents, adapter);

    for (const cmd of generatedCommands) {
      const filePath = path.resolve(resolvedPath, cmd.path);
      await FileSystemUtils.writeFile(filePath, cmd.fileContent);
    }
  }
}

const DOC_VERIFICATION_WORKFLOWS = new Set(['topic', 'explain', 'practice']);

function isDocVerificationTemplate(workflowId: string): boolean {
  return DOC_VERIFICATION_WORKFLOWS.has(workflowId);
}

function injectContext7Guidance(instructions: string): string {
  const marker = '\n## Command:';
  const index = instructions.indexOf(marker);
  if (index === -1) return instructions + CONTEXT7_GUIDANCE;
  return instructions.slice(0, index) + CONTEXT7_GUIDANCE + instructions.slice(index);
}
