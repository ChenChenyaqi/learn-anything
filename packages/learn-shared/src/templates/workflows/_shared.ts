export const HIDDEN_DIR_WARNING = `
## ⚠️ Accessing Files Under .learn/

\`.learn/\` is a **hidden directory** (name starts with a dot). The glob tool and most file-search utilities **skip dotfiles and dot-directories by default**, so glob patterns like \`**/state.json\` or \`.learn/topics/*/state.json\` will return nothing.

Always use these methods instead:
- **List topics**: Bash tool — \`ls -d .learn/topics/*/\`
- **Check if a path exists**: Bash tool — \`ls .learn/topics/<name>/state.json\` (exits non-zero if missing)
- **Read a file**: Read tool with the explicit dot-prefixed path (e.g. \`.learn/topics/<name>/state.json\`) — the Read tool works fine with explicit dot-paths; only the glob/search tools have the problem.
`;

export const STATE_UPDATE_TABLE = `| Performance | Criteria | Updates |
|---|---|---|
| ✅ Strong | Almost all correct (or code runs correctly, handles edge cases) | confidence +0.1~0.15 (cap 1.0), practice_count +1, last_practiced = today. If confidence > 0.7 AND practice_count ≥ 2 → mastered, else in_progress |
| 🟡 Partial | Core ideas right, some mistakes (or minor issues) | confidence +0.05 (cap 1.0), practice_count +1, last_practiced = today, status → needs_practice |
| 🔴 Weak | Mostly wrong or blank (or doesn't run / wrong direction) | confidence unchanged, practice_count unchanged, status → needs_practice |`;
