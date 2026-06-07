import type { SkillTemplate, CommandTemplate } from '../types.js';

const SKILL_NAME = 'learn-anything-status';
const SKILL_DESCRIPTION =
  'Visualize your current learning state. Display a knowledge map heatmap with mastery status for each concept.';

const INSTRUCTIONS = `You are Learn Anything's Status Visualizer. Your sole task is to run the status script and present its output to the user.

## Command: /learn-status [topic-name]

### Step 1: Determine Locale

- If the user speaks Chinese, use \`--locale zh-CN\`
- Otherwise, use \`--locale en\` (default)

### Step 2: Determine Mode

- If the user **specified a topic name**: run the script with that single topic (detailed heatmap)
- If the user did **NOT** specify a topic:
  - Run the script with \`--all\` flag to show a summary of **all** topics

### Step 3: Run Status Script

Use the Bash tool to run the status script (located in the scripts/ directory next to this SKILL.md file):

**Single topic (detailed heatmap):**
\`\`\`bash
SCRIPT=$(find . -path '*/learn-anything-status/scripts/status.mjs' -print -quit 2>/dev/null)
node "$SCRIPT" --locale <locale> ./.learn/topics/<topic-name>
\`\`\`

**All topics (summary by topic):**
\`\`\`bash
SCRIPT=$(find . -path '*/learn-anything-status/scripts/status.mjs' -print -quit 2>/dev/null)
node "$SCRIPT" --all --locale <locale> ./.learn/topics
\`\`\`

The script reads state.json, validates it, and outputs a formatted heatmap or topic summary directly.
Show the script output to the user as-is.

If the script reports validation errors, relay the error to the user.

---

## Edge Cases

- **No topics at all**: The script will output a friendly message. Relay it to the user.`;

const COMMAND_NAME = 'Learn: Status';
const COMMAND_DESCRIPTION =
  'Visualize learning state — knowledge map heatmap with mastery status per concept';

const COMMAND_CONTENT = `Use the learn-anything-status skill to handle the user's /learn-status [topic-name] request.
Follow the workflow defined in the skill:
1. Determine locale based on user's language (zh-CN or en)
2. Determine mode: single topic (detailed) or all topics (summary)
3. Run status.mjs script with appropriate flags
Show the script output to the user.`;

export function getLearnStatusSkillTemplate(): SkillTemplate {
  return {
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    instructions: INSTRUCTIONS,
    license: 'MIT',
    compatibility: 'Requires learn-anything CLI.',
    metadata: { author: 'learn-anything', version: '1.0' },
  };
}

export function getLearnStatusCommandTemplate(): CommandTemplate {
  return {
    name: COMMAND_NAME,
    description: COMMAND_DESCRIPTION,
    category: 'Learning',
    tags: ['learning', 'status', 'visualization'],
    content: COMMAND_CONTENT,
  };
}
