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

### Step 1: Check prerequisites

Check that the workspace has a \`.learn/topics/\` directory with at least one topic state.json file.

If no topics exist, tell the user to create one with \`/learn:topic <topic-name>\` first.

### Step 2: Generate the site project

Execute the CLI command:

\`\`\`bash
learn-anything site
\`\`\`

If \`learn-anything\` is not available as a global command, use \`npx learn-anything site\`.

If a \`site/\` directory already exists, use \`--force\` to overwrite, or inform the user and ask if they want to proceed.

### Step 3: Present the summary

After generation, display a summary:

> 🏗️ Site project generated at \`site/\` (3 files: package.json, build.mjs, .gitignore)
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

### Step 4: Offer deployment guidance (if asked)

If the user asks about deploying:
- **Netlify**: Drag \`site/\` folder to Netlify Drop, set build command to \`npm run build\`, publish directory to \`dist\`
- **Vercel**: Import the \`site/\` directory, framework preset "Vite", build command \`npm run build\`, output directory \`dist\`
- **GitHub Pages**: Use \`gh-pages\` package or GitHub Actions to deploy \`site/dist/\`

---

## Edge Cases

- **No topics**: Tell user to run \`/learn:topic <name>\` first.
- **site/ already exists**: Ask user if they want to overwrite, or use \`learn-anything site --force\`.
- **learn-anything CLI not installed**: Tell user to install globally: \`npm install -g learn-anything-cli\`, or use \`npx\`.`;

const COMMAND_NAME = 'Learn: Site';
const COMMAND_DESCRIPTION = 'Generate a deployable site project from learning data';
const COMMAND_CATEGORY = 'Deployment';

const COMMAND_CONTENT = `Use the learn-anything-site skill to handle the user's /learn:site request.
Follow the workflow defined in the skill:
1. Check that .learn/topics/ exists with at least one topic
2. Execute the CLI command: learn-anything site
3. Present a summary of generated files and next steps (npm install, npm run server, npm run build)
4. If the user asks about deployment, provide guidance for Netlify, Vercel, or GitHub Pages`;

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
