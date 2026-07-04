//! Working-folder-scoped filesystem & shell tools for the rig agent.
//!
//! Every tool here implements [`rig_core::tool::Tool`] and operates strictly
//! inside a [`Workspace`] rooted at the configured working folder. Paths are
//! canonicalized before any read/write/list/edit so `..` segments and symlinks
//! that escape the workspace are rejected rather than silently followed.
//!
//! Tool outputs are plain `String`s so the model receives them verbatim (rig's
//! `serialize_tool_output` passes `Output = String` through unchanged). On
//! failure each tool returns a [`ToolError`] whose `Display` strings are
//! model-actionable (named reason + resolved-vs-allowed prefix), so the
//! agentic loop receives a `ToolResult` with `status = "error"` rather than
//! aborting.
//!
//! Each tool struct embeds a cloned [`Workspace`] (cheap: the canonical root
//! is cached behind an `Arc<OnceLock>`); the model-provided arguments live in
//! a separate `*Args` serde struct so the model only ever sees the arguments
//! and never the workspace. Construction is via each tool's `new(workspace)`
//! constructor.
//!
//! # Layout
//!
//! - [`error`] — the [`ToolError`] enum
//! - [`workspace`] — [`Workspace`] + canonicalize-based path guards
//! - [`read_file`] / [`write_file`] / [`edit_file`] / [`list_dir`] / [`grep`]
//!   / [`glob`] / [`run_command`] — one file per tool

mod edit_file;
mod error;
mod glob;
mod grep;
mod list_dir;
mod read_file;
mod run_command;
mod workspace;
mod write_file;

pub use edit_file::{EditArgs, EditFile};
pub use error::ToolError;
pub use glob::{Glob, GlobArgs};
pub use grep::{Grep, GrepArgs};
pub use list_dir::{ListArgs, ListDir};
pub use read_file::{ReadArgs, ReadFile};
pub use run_command::{RunCommand, RunCommandArgs};
pub use workspace::Workspace;
pub use write_file::{WriteArgs, WriteFile};

/* ------------------------------------------------------------------ */
/*  Shared constants                                                   */
/* ------------------------------------------------------------------ */

/// 200 KB — the byte ceiling above which `ReadFile` truncates content.
pub const READ_FILE_LIMIT: usize = 200 * 1024;
/// A single returned line longer than this many characters is truncated in
/// `ReadFile` output so one pathologically long line does not eat the whole
/// byte budget.
pub const READ_LINE_LIMIT: usize = 2000;
/// Each of stdout/stderr is truncated at 4 KB in `RunCommand`.
pub const RUN_CMD_STREAM_LIMIT: usize = 4 * 1024;
/// Max result rows emitted by `Grep` before a truncation marker.
pub const GREP_RESULT_LIMIT: usize = 100;
/// Max file paths emitted by `Glob` before capping.
pub const GLOB_RESULT_LIMIT: usize = 500;

/// Directory entries pruned from `list_dir` output and from recursive walks.
/// Hidden entries (leading `.`) are pruned separately at each call site.
pub(super) const LIST_IGNORE: &[&str] = &["node_modules", "target", ".git"];

/// Tool names exposed by this module, in registration order. Used by the
/// agent's system-prompt builder to enumerate available tools.
pub const ALL_TOOL_NAMES: &[&str] = &[
    "read_file",
    "write_file",
    "edit_file",
    "list_dir",
    "grep",
    "glob",
    "run_command",
];

// Backwards-compat alias kept so external `use learn_agent::ALL_TOOLS;` works.
pub const ALL_TOOLS: &[&str] = ALL_TOOL_NAMES;

/* ------------------------------------------------------------------ */
/*  Cross-cutting tests                                                */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;
    use rig_core::completion::ToolDefinition;
    use rig_core::tool::Tool;

    #[tokio::test]
    async fn all_tools_have_unique_names() {
        let ws = Workspace::new(".");
        let names = vec![
            ReadFile::new(ws.clone()).name(),
            WriteFile::new(ws.clone()).name(),
            EditFile::new(ws.clone()).name(),
            ListDir::new(ws.clone()).name(),
            Grep::new(ws.clone()).name(),
            Glob::new(ws.clone()).name(),
            RunCommand::new(ws).name(),
        ];
        let mut sorted = names.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), names.len(), "tool names must be unique, got {names:?}");
        assert_eq!(names, ALL_TOOL_NAMES, "names match ALL_TOOL_NAMES");
    }

    #[tokio::test]
    async fn tool_definitions_emit_json_objects() {
        let ws = Workspace::new(".");
        let tools: Vec<ToolDefinition> = vec![
            ReadFile::new(ws.clone()).definition(String::new()).await,
            WriteFile::new(ws.clone()).definition(String::new()).await,
            EditFile::new(ws.clone()).definition(String::new()).await,
            ListDir::new(ws.clone()).definition(String::new()).await,
            Grep::new(ws.clone()).definition(String::new()).await,
            Glob::new(ws.clone()).definition(String::new()).await,
            RunCommand::new(ws).definition(String::new()).await,
        ];
        for def in tools {
            assert!(
                matches!(def.parameters, serde_json::Value::Object(_)),
                "{} has no parameters struct",
                def.name
            );
            assert!(!def.description.is_empty(), "{} has no description", def.name);
        }
    }
}