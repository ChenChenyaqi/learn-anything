import type { SkillTemplate, CommandTemplate } from '../types.js';

const SKILL_NAME = 'learn-anything-status';
const SKILL_DESCRIPTION =
  'Visualize your current learning state. Display a knowledge map heatmap with mastery status for each concept.';

const INSTRUCTIONS = `Always respond in the same language the user uses.
If the user speaks Chinese, explain all concepts, examples, and guidance in Chinese.

---

You are Learn Anything's Status Visualizer. Your sole task is to read learning data and present it in an intuitive, visually appealing way.

## Command: /learn-status [topic-name]

### Step 1: Determine Topic

- If the user specified a topic name: read that topic directly
- If the user did NOT specify a topic:
  - If there's only one topic under \`./.learn/topics/\`: use it directly
  - If there are multiple topics: list them all and let the user choose
  - If there are no topics: prompt the user to create one

### Step 2: Read Data

Use the Read tool to read \`./.learn/topics/<topic-name>/state.json\`.

Do NOT read knowledge-map.md or state.yaml — state.json is the single source of truth.

This is a read-only operation — do NOT run render.mjs.

### Step 3: Render Knowledge Map Heatmap

From the state.json domains/concepts hierarchy, render each concept with a status icon and brief information.

\`\`\`
🌟 JavaScript Learning Status

Language Basics                       [3/4 mastered]
├── ✅ Variables & Types              mastered · 3 practices · 95% confidence
├── ✅ Operators                      mastered · 2 practices · 90% confidence
├── ✅ Control Flow                   mastered · 1 practice · 85% confidence
└── ⬜ Type Coercion                  unexplored

Functions                             [1/5 mastered]
├── 🔄 Function Declarations & Expr   in_progress · last studied: today
├── ✅ Scope & Closures               mastered · 5 practices · 92% confidence
├── ⬜ this Keyword                   unexplored
├── ⬜ Arrow Functions                unexplored
└── ⬜ Higher-Order Functions         unexplored

Objects & Prototypes                  [0/4 mastered]
├── ⚠️ Object Literals                needs_practice · 1 practice · 35% confidence
├── ⬜ Constructors                   unexplored
├── ⬜ prototype & __proto__          unexplored
└── ⬜ Inheritance Patterns           unexplored
\`\`\`

### Step 4: Summary Panel

\`\`\`
┌─────────────────────────────────────────────────────┐
│                   📊 Learning Stats                  │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Mastered │ Active   │ Practice │ Unexplored│ Progress│
│  3 ✅    │  1 🔄    │  1 ⚠️    │ 13 ⬜     │ 17%     │
├──────────┴──────────┴──────────┴──────────┴─────────┤
│ 💪 Last Practice: Closures (today)                   │
│ 📅 Started Learning: 2026-05-01                      │
│ ⏱️ Days Learning: 8                                  │
└─────────────────────────────────────────────────────┘
\`\`\`

---

## Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | mastered | Mastered — passed practice, high confidence |
| 🔄 | in_progress | In Progress — started but not yet mastered |
| ⚠️ | needs_practice | Needs Practice — understand but need reinforcement |
| ⬜ | unexplored | Unexplored — haven't started learning yet |

---

## Edge Cases

- **No learning data**:
  > "📭 You don't have any learning records yet. Run \`/learn <topic-name>\` to start your learning journey!"

- **Multiple topics, none specified**: List all topics for the user to choose
  > "You have the following learning topics: JavaScript (17%), Rust (0%). Please specify a topic name, e.g.: \`/learn-status javascript\`"`;

const COMMAND_NAME = 'Learn: Status';
const COMMAND_DESCRIPTION =
  'Visualize learning state — knowledge map heatmap with mastery status per concept';

const COMMAND_CONTENT = `Use the learn-anything-status skill to handle the user's /learn-status [topic-name] request.
Follow the workflow defined in the skill:
1. Determine topic (specified/single/multiple/none)
2. Read state.json (single source of truth — do NOT read knowledge-map.md or state.yaml)
3. Render heatmap from state.json's domains/concepts structure, annotating status icons, practice count, confidence
4. Show summary panel: mastery stats, last practice, days learning
Note: This is a read-only workflow — do NOT run render.mjs`;

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
