/**
 * Context7 documentation verification guidance.
 * Injected into topic/explain/practice/quiz skill templates.
 *
 * NOT injected into review/status templates (those are about progress review
 * and visualization, not teaching content).
 */

/**
 * MCP-based guidance — used by the CLI when generating skill files for
 * host agents (Claude Code, Cursor, etc.) that may have Context7 MCP
 * configured externally.
 *
 * References the `resolve-library-id` and `query-docs` MCP tools.
 * Host agents WITHOUT Context7 MCP configured will fall back to built-in
 * knowledge per the trailing caveats.
 */
export const CONTEXT7_GUIDANCE = `
## Documentation Verification (Context7)

When teaching about a specific library or framework, verify your explanations against official documentation using Context7 MCP tools:

1. **Resolve the library**: Call \`resolve-library-id\` with the library name (e.g., "React", "TypeScript")
2. **Fetch relevant docs**: Call \`query-docs\` with the resolved library ID and the concept you are teaching as the query
3. **Cross-reference**: Ensure your explanations, code examples, and API usage match the official documentation
4. **Defer to docs**: If your explanation conflicts with official documentation, use the official documentation as the authoritative source

If Context7 MCP tools are not available in your environment, proceed with your built-in knowledge.
`;

/**
 * Skill-based guidance — used by the GUI sidecar to instruct the pi agent
 * (which has no MCP) to use the `find-docs` skill with the Context7 CLI.
 *
 * The sidecar writes a `find-docs/SKILL.md` file to `<appDataDir>/skills/`
 * alongside the learn-anything skill files. The pi agent auto-discovers
 * both via `additionalSkillPaths`, and the agent uses the bash tool to
 * run `npx ctx7@latest` commands per the find-docs workflow. No MCP
 * server or MCP bridge is needed.
 */
export const CONTEXT7_GUIDANCE_SKILL = `
## Documentation Verification (Context7)

When teaching about a specific library or framework, verify your explanations against official documentation using the \`find-docs\` skill:

1. **Use the skill**: Read the \`find-docs\` skill's SKILL.md file (listed in your available skills) and follow its two-step workflow
2. **Resolve the library**: Run \`npx ctx7@latest library <name> "<query>"\` to obtain a Context7 library ID
3. **Fetch relevant docs**: Run \`npx ctx7@latest docs <libraryId> "<query>"\` with the concept you are teaching as the query
4. **Cross-reference**: Ensure your explanations, code examples, and API usage match the official documentation
5. **Defer to docs**: If your explanation conflicts with official documentation, use the official documentation as the authoritative source

Keep the query specific to a single concept (e.g., "React useEffect cleanup with async" — not "hooks"). Do not run more than 3 \`npx ctx7@latest\` commands per topic to avoid excessive latency.

If the \`find-docs\` skill is not available in your environment, or the Context7 CLI (\`npx ctx7@latest\`) is not installed, proceed with your built-in knowledge.
`;

const DOC_VERIFICATION_WORKFLOWS = new Set(['topic', 'explain', 'practice', 'quiz']);

/** Whether a workflow's skill template should include Context7 guidance. */
export function isDocVerificationWorkflow(workflowId: string): boolean {
  return DOC_VERIFICATION_WORKFLOWS.has(workflowId);
}

/**
 * Insert `CONTEXT7_GUIDANCE` (MCP variant) just before the `## Command:`
 * marker in the skill instructions. Falls back to appending at the end
 * if the marker is not found.
 *
 * Used by the CLI when generating skill files for host agents that may
 * have Context7 MCP configured.
 */
export function injectContext7Guidance(instructions: string): string {
  const marker = '\n## Command:';
  const index = instructions.indexOf(marker);
  if (index === -1) return instructions + CONTEXT7_GUIDANCE;
  return instructions.slice(0, index) + CONTEXT7_GUIDANCE + instructions.slice(index);
}

/**
 * Insert `CONTEXT7_GUIDANCE_SKILL` (find-docs skill variant) just before
 * the `## Command:` marker in the skill instructions. Falls back to
 * appending at the end if the marker is not found.
 *
 * Used by the sidecar when generating SKILL.md files for the pi agent,
 * which has no MCP support and instead uses the find-docs skill with the
 * Context7 CLI (`npx ctx7@latest`).
 */
export function injectContext7GuidanceForSkill(instructions: string): string {
  const marker = '\n## Command:';
  const index = instructions.indexOf(marker);
  if (index === -1) return instructions + CONTEXT7_GUIDANCE_SKILL;
  return instructions.slice(0, index) + CONTEXT7_GUIDANCE_SKILL + instructions.slice(index);
}
