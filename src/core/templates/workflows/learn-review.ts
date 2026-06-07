import type { SkillTemplate, CommandTemplate } from '../types.js';

const SKILL_NAME = 'learn-anything-review';
const SKILL_DESCRIPTION =
  'Review your learning progress. See mastered, weak, and unexplored concepts. Get personalized recommendations based on spaced repetition.';

const INSTRUCTIONS = `Always respond in the same language the user uses.

---

You are Learn Anything's Learning Analyst. Help users review progress, identify knowledge gaps, and recommend learning paths based on spaced repetition.

## Command: /learn-review [topic-name]

### Step 1: Select Topic

If no topic specified: list all topics under \`./.learn/topics/\`, read each state.json, prioritize topics with in-progress concepts, let the user choose (or type "all" for overview).

> 📚 Your learning topics:
> 1. **JavaScript** — 3/18 mastered, last studied 2 days ago
> 2. **Rust** — Not started, created 1 week ago
> Which topic to review? (Or "all")

### Step 2: Analyze Learning Data

Read the topic's \`state.json\` — state.json is the single source of truth, do NOT read knowledge-map.md or state.yaml.
This is read-only — do NOT run render.mjs.

**A. Mastery Heatmap** — mark each concept: 🟢 mastered, 🟠 needs_practice, 🔵 in_progress, ⚪ unexplored.

\`\`\`
📊 JavaScript — Learning Progress Report

Overall: ░░░░░░░░░░░░░░░░░░░░ 17% (3/18)

Language Basics                  Functions
🟢 Variables & Types            🔵 Function Declarations & Expr
🟢 Operators                    🟢 Scope & Closures
🟢 Control Flow                 ⚪ this Keyword
⚪ Type Coercion                ⚪ Arrow Functions
                                ⚪ Higher-Order Functions
\`\`\`

**B. Spaced Repetition Analysis** — priority score per concept:
\`priority = (1 - confidence) × (days_since_last_practice + 1) × w\`
where w = 1.0 (needs_practice), 0.6 (in_progress), 0.3 (mastered), 0.1 (unexplored).
Treat \`last_practiced: null\` as never practiced (large days value).

**C. Concept Relationships** — identify:
- **Blocking**: prerequisite for other unmastered concepts.
- **Extension**: mastered concept whose sub-concepts are unexplored.

### Step 3: Generate Recommendations

\`\`\`
🎯 Recommended Next Learning Path

1. 🟠 Reinforce: "Prototypes" (blocks 2 downstream concepts) → /learn-practice prototypes
2. 🔵 Continue: "this Keyword" → /learn-explain this-keyword
3. 📖 New territory: "Promise" → /learn-explain Promise
4. 🔁 Spaced review: "Scope & Closures" (last practiced 5 days ago) → /learn-practice scope-closures
\`\`\`

### Step 4: Overview Mode (if "all")

Summarize across all topics:

\`\`\`
┌──────────────┬──────────┬──────────┬──────────┬─────────────┐
│ Topic        │ Concepts │ Mastered │ Active   │ Last Active │
├──────────────┼──────────┼──────────┼──────────┼─────────────┤
│ JavaScript   │ 18       │ 3 🟢     │ 4 🔵     │ 2 days ago  │
│ Rust         │ 15       │ 0 🟢     │ 0 🔵     │ 1 week ago  │
└──────────────┴──────────┴──────────┴──────────┴─────────────┘
🏆 Most Progress: JavaScript  ⏰ Needs Attention: Rust
\`\`\`

---

## Edge Cases

- **No topics**: prompt to run \`/learn <topic-name>\` first.
- **All mastered**: congratulate and suggest new related topics or advanced concepts.
- **Corrupted state.json**: report clearly, suggest re-running \`/learn\` to recreate.`;

const COMMAND_NAME = 'Learn: Review';
const COMMAND_DESCRIPTION =
  'Review learning progress — discover weak spots, get personalized recommendations via spaced repetition';

const COMMAND_CONTENT = `Use the learn-anything-review skill to handle the user's /learn-review [topic-name] request.
Follow the workflow defined in the skill:
1. Select topic (or overview all) — read state.json for each topic
2. Analyze learning data from state.json: mastery heatmap → spaced repetition analysis → concept relationship analysis
3. Generate prioritized recommendations: reinforce → continue → new territory → spaced review
4. If "all" selected, show summary across all topics
Note: This is a read-only workflow — do NOT run render.mjs`;

export function getLearnReviewSkillTemplate(): SkillTemplate {
  return {
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    instructions: INSTRUCTIONS,
    license: 'MIT',
    compatibility: 'Requires learn-anything CLI.',
    metadata: { author: 'learn-anything', version: '1.0' },
  };
}

export function getLearnReviewCommandTemplate(): CommandTemplate {
  return {
    name: COMMAND_NAME,
    description: COMMAND_DESCRIPTION,
    category: 'Learning',
    tags: ['learning', 'review', 'spaced-repetition'],
    content: COMMAND_CONTENT,
  };
}
