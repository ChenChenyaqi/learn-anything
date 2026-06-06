import path from 'path';
import chalk from 'chalk';
import * as fs from 'fs';
import { createRequire } from 'module';
import { FileSystemUtils } from '../utils/file-system.js';
import { AI_TOOLS, AIToolOption, LEARN_DIR, DEFAULT_DOC_URLS } from './config.js';
import { isInteractive } from '../utils/interactive.js';
import { generateCommands, CommandAdapterRegistry } from './command-generation/index.js';
import {
  getSkillTemplates,
  getCommandContents,
  generateSkillContent,
  buildDocUrlsSection,
  buildDocsPathSection,
} from './shared/index.js';
import type { SupportedLocale } from '../i18n/types.js';
import { getMessages } from '../i18n/index.js';
import { promptDocStoragePath } from './doc-selection.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../../package.json');

type InitCommandOptions = {
  tools?: string;
  force?: boolean;
  locale?: SupportedLocale;
  update?: boolean;
};

export class InitCommand {
  private readonly toolsArg?: string;
  private readonly force: boolean;
  private readonly locale: SupportedLocale;
  private readonly isUpdate: boolean;

  constructor(options: InitCommandOptions = {}) {
    this.toolsArg = options.tools;
    this.force = options.force ?? false;
    this.locale = options.locale ?? 'en';
    this.isUpdate = options.update ?? false;
  }

  async execute(targetPath: string = '.'): Promise<void> {
    const resolvedPath = path.resolve(targetPath);
    const m = getMessages(this.locale);

    // Ensure target directory exists
    await FileSystemUtils.ensureDir(resolvedPath);

    // Create .learn/ directory in the target project
    const learnDir = path.join(resolvedPath, LEARN_DIR);
    await FileSystemUtils.ensureDir(path.join(learnDir, 'topics'));
    await FileSystemUtils.ensureDir(path.join(learnDir, 'docs'));

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

    // Collect doc storage path — all DEFAULT_DOC_URLS are baked into skills
    const storagePath = await promptDocStoragePath(this.locale);
    console.log(chalk.dim(`  📚 Doc storage → ${storagePath}`));
    console.log('');

    // Generate skill files for each tool
    for (const tool of selectedTools) {
      if (!tool.skillsDir) continue;
      await this.generateSkillsForTool(resolvedPath, tool, storagePath);
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

  private async generateSkillsForTool(
    resolvedPath: string,
    tool: AIToolOption,
    storagePath: string,
  ): Promise<void> {
    const skillTemplates = getSkillTemplates();
    const docUrlsSection = buildDocUrlsSection(DEFAULT_DOC_URLS);
    const docsPathSection = buildDocsPathSection(storagePath);

    for (const entry of skillTemplates) {
      const skillDir = path.join(resolvedPath, tool.skillsDir!, 'skills', entry.dirName);
      const skillFile = path.join(skillDir, 'SKILL.md');
      const content = generateSkillContent(entry.template, VERSION, (instructions) => {
        return instructions
          .replace(/\{\{DOC_URLS\}\}/g, docUrlsSection)
          .replace(/\{\{DOCS_PATH\}\}/g, docsPathSection);
      });
      await FileSystemUtils.writeFile(skillFile, content);
    }
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
