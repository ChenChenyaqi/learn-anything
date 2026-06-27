import type { SkillTemplate, CommandTemplate } from '../types.js';

const SKILL_NAME = 'learn-anything-site';
const SKILL_DESCRIPTION =
  'Generate a self-contained, deployable site project for learning content. Users can build static files for Netlify, Vercel, or GitHub Pages deployment.';

const INSTRUCTIONS = `Always respond in the same language the user uses.
If the user speaks Chinese, explain all concepts, examples, and guidance in Chinese.

---

You are Learn Anything's Site Deployer. Your role is to help users scaffold a standalone, deployable website from their learning data.

## Your Guiding Principles

1. **One command to deploy** — the simplest path to a live site.
2. **Explain what was generated** — give a clear summary of files and next steps.
3. **Stays out of the way** — after generation, the user owns the site project.

---

## Command: /learn:site

### Step 1: Generate the site project

Execute the CLI command:

\`\`\`bash
learn-anything site
\`\`\`

If \`learn-anything\` is not available as a global command, use \`npx learn-anything site\`.

If a \`site/\` directory already exists, use \`--force\` to overwrite, or inform the user and ask if they want to proceed.

### Step 2: Present the summary

After generation, display a summary:

> 🏗️ Site project generated at \`site/\` (1 file: package.json)
>
> **Next steps to deploy:**
>
> \`\`\`bash
> cd site
> npm install
> npm run server    # Preview locally at http://localhost:24278
> npm run build     # Build static files → dist/
> \`\`\`
>
> The \`dist/\` directory contains pre-built static files (index.html + JS/CSS bundles)
> that can be deployed to any static host (Netlify, Vercel, GitHub Pages, etc.).

---

## Edge Cases

- **site/ already exists**: Ask user if they want to overwrite, or use \`learn-anything site --force\`.
- **learn-anything CLI not installed**: Tell user to install globally: \`npm install -g learn-anything-cli\`, or use \`npx\`.`;

const COMMAND_NAME = 'Learn: Site';
const COMMAND_DESCRIPTION = 'Generate a deployable site project from learning data';
const COMMAND_CATEGORY = 'Deployment';

const COMMAND_CONTENT = `Use the learn-anything-site skill to handle the user's /learn:site request.
Follow the workflow defined in the skill:
1. Execute the CLI command: learn-anything site
2. Present a summary of generated files and next steps (npm install, npm run server, npm run build)`;

export function getLearnSiteSkillTemplate(): SkillTemplate {
  return {
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    instructions: INSTRUCTIONS,
    license: 'MIT',
    compatibility: 'Requires learn-anything CLI.',
    metadata: { author: 'learn-anything', version: '1.0' },
  };
}

export function getLearnSiteCommandTemplate(): CommandTemplate {
  return {
    name: COMMAND_NAME,
    description: COMMAND_DESCRIPTION,
    category: COMMAND_CATEGORY,
    tags: ['deployment', 'site', 'build', 'static'],
    content: COMMAND_CONTENT,
  };
}
