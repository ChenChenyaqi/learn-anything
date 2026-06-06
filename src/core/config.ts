export const LEARN_DIR = '.learn';

export interface DocUrlEntry {
  name: string;
  toc: string;
  base: string;
}

export const DEFAULT_DOC_URLS: Record<string, DocUrlEntry> = {
  javascript: {
    name: 'JavaScript',
    toc: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
    base: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/',
  },
  typescript: {
    name: 'TypeScript',
    toc: 'https://www.typescriptlang.org/docs/handbook/intro.html',
    base: 'https://www.typescriptlang.org/docs/handbook/',
  },
  react: {
    name: 'React',
    toc: 'https://react.dev/learn',
    base: 'https://react.dev/learn/',
  },
  vue: {
    name: 'Vue',
    toc: 'https://vuejs.org/guide/introduction.html',
    base: 'https://vuejs.org/guide/',
  },
  python: {
    name: 'Python',
    toc: 'https://docs.python.org/3/tutorial/index.html',
    base: 'https://docs.python.org/3/tutorial/',
  },
  rust: {
    name: 'Rust',
    toc: 'https://doc.rust-lang.org/book/',
    base: 'https://doc.rust-lang.org/book/',
  },
  go: {
    name: 'Go',
    toc: 'https://go.dev/doc/',
    base: 'https://go.dev/doc/',
  },
};

export interface AIToolOption {
  name: string;
  value: string;
  available: boolean;
  successLabel?: string;
  skillsDir?: string;
  detectionPaths?: string[];
}

export const AI_TOOLS: AIToolOption[] = [
  {
    name: 'Amazon Q Developer',
    value: 'amazon-q',
    available: true,
    successLabel: 'Amazon Q Developer',
    skillsDir: '.amazonq',
  },
  {
    name: 'Antigravity',
    value: 'antigravity',
    available: true,
    successLabel: 'Antigravity',
    skillsDir: '.agent',
  },
  {
    name: 'Auggie (Augment CLI)',
    value: 'auggie',
    available: true,
    successLabel: 'Auggie',
    skillsDir: '.augment',
  },
  {
    name: 'Bob Shell',
    value: 'bob',
    available: true,
    successLabel: 'Bob Shell',
    skillsDir: '.bob',
  },
  {
    name: 'Claude Code',
    value: 'claude',
    available: true,
    successLabel: 'Claude Code',
    skillsDir: '.claude',
  },
  { name: 'Cline', value: 'cline', available: true, successLabel: 'Cline', skillsDir: '.cline' },
  { name: 'Codex', value: 'codex', available: true, successLabel: 'Codex', skillsDir: '.codex' },
  {
    name: 'ForgeCode',
    value: 'forgecode',
    available: true,
    successLabel: 'ForgeCode',
    skillsDir: '.forge',
  },
  {
    name: 'CodeBuddy Code (CLI)',
    value: 'codebuddy',
    available: true,
    successLabel: 'CodeBuddy Code',
    skillsDir: '.codebuddy',
  },
  {
    name: 'Continue',
    value: 'continue',
    available: true,
    successLabel: 'Continue (VS Code / JetBrains / Cli)',
    skillsDir: '.continue',
  },
  {
    name: 'CoStrict',
    value: 'costrict',
    available: true,
    successLabel: 'CoStrict',
    skillsDir: '.cospec',
  },
  { name: 'Crush', value: 'crush', available: true, successLabel: 'Crush', skillsDir: '.crush' },
  {
    name: 'Cursor',
    value: 'cursor',
    available: true,
    successLabel: 'Cursor',
    skillsDir: '.cursor',
  },
  {
    name: 'Factory Droid',
    value: 'factory',
    available: true,
    successLabel: 'Factory Droid',
    skillsDir: '.factory',
  },
  {
    name: 'Gemini CLI',
    value: 'gemini',
    available: true,
    successLabel: 'Gemini CLI',
    skillsDir: '.gemini',
  },
  {
    name: 'GitHub Copilot',
    value: 'github-copilot',
    available: true,
    successLabel: 'GitHub Copilot',
    skillsDir: '.github',
    detectionPaths: [
      '.github/copilot-instructions.md',
      '.github/instructions',
      '.github/workflows/copilot-setup-steps.yml',
      '.github/prompts',
      '.github/agents',
      '.github/skills',
      '.github/.mcp.json',
    ],
  },
  { name: 'iFlow', value: 'iflow', available: true, successLabel: 'iFlow', skillsDir: '.iflow' },
  { name: 'Junie', value: 'junie', available: true, successLabel: 'Junie', skillsDir: '.junie' },
  {
    name: 'Kilo Code',
    value: 'kilocode',
    available: true,
    successLabel: 'Kilo Code',
    skillsDir: '.kilocode',
  },
  { name: 'Kiro', value: 'kiro', available: true, successLabel: 'Kiro', skillsDir: '.kiro' },
  {
    name: 'OpenCode',
    value: 'opencode',
    available: true,
    successLabel: 'OpenCode',
    skillsDir: '.opencode',
  },
  { name: 'Pi', value: 'pi', available: true, successLabel: 'Pi', skillsDir: '.pi' },
  { name: 'Qoder', value: 'qoder', available: true, successLabel: 'Qoder', skillsDir: '.qoder' },
  {
    name: 'Lingma',
    value: 'lingma',
    available: true,
    successLabel: 'Lingma',
    skillsDir: '.lingma',
  },
  {
    name: 'Qwen Code',
    value: 'qwen',
    available: true,
    successLabel: 'Qwen Code',
    skillsDir: '.qwen',
  },
  {
    name: 'RooCode',
    value: 'roocode',
    available: true,
    successLabel: 'RooCode',
    skillsDir: '.roo',
  },
  { name: 'Trae', value: 'trae', available: true, successLabel: 'Trae', skillsDir: '.trae' },
  {
    name: 'Windsurf',
    value: 'windsurf',
    available: true,
    successLabel: 'Windsurf',
    skillsDir: '.windsurf',
  },
  {
    name: 'AGENTS.md (works with Amp, VS Code, …)',
    value: 'agents',
    available: false,
    successLabel: 'your AGENTS.md-compatible assistant',
  },
];
