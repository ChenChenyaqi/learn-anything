export const HIDDEN_DIR_WARNING = `
## ⚠️ Accessing Files Under .learn/

\`.learn/\` is a **hidden directory** (name starts with a dot). The glob tool and most file-search utilities **skip dotfiles and dot-directories by default**, so glob patterns like \`**/state.json\` or \`.learn/topics/*/state.json\` will return nothing.

Always use these methods instead:
- **List topics**: list the subdirectories of \`.learn/topics/\` with the shell tool — bash: \`ls -d .learn/topics/*/\`; PowerShell: \`Get-ChildItem .learn/topics -Directory -Name\`
- **Check if a path exists**: check \`.learn/topics/<name>/state.json\` with the shell tool — bash: \`ls .learn/topics/<name>/state.json\`; PowerShell: \`Test-Path .learn/topics/<name>/state.json\`
- **Read a file**: Read tool with the explicit dot-prefixed path (e.g. \`.learn/topics/<name>/state.json\`) — the Read tool works fine with explicit dot-paths; only the glob/search tools have the problem.
`;

export const SKILL_BASE_NOTE = `This skill ships its own \`scripts/\` directory. \`<skill-base>\` is the base directory the skill loader reports when the skill loads (OpenCode: \`.opencode/skills/<skill-name>\`; Claude Code: \`.claude/skills/<skill-name>\`). Run its scripts as \`node "<skill-base>/scripts/<name>.mjs"\` — never locate them with \`find\`, whose GNU syntax fails on Windows/PowerShell.`;

export const STATE_UPDATE_TABLE = `| Performance | Criteria | Updates |
|---|---|---|
| ✅ Strong | Almost all correct (or submitted work runs correctly and handles edge cases) | confidence +0.1~0.15 (cap 1.0), practice_count +1, last_practiced = today. If confidence > 0.7 AND practice_count ≥ 2 → mastered, else in_progress |
| 🟡 Partial | Core ideas right, some mistakes (or minor issues) | confidence +0.05 (cap 1.0), practice_count +1, last_practiced = today, status → needs_practice |
| 🔴 Weak | Mostly wrong or blank (or the work is off-track) | confidence unchanged, practice_count unchanged, status → needs_practice |`;
