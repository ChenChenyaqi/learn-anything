//! `EditFile` — exact string substitution in an existing file inside the
//! workspace. Fails when `old` == `new` (no-op), when `old` is absent, or
//! (with `replace_all=false`) when `old` appears more than once. Reports the
//! number of replacements made on success.

use futures::Future;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{ToolError, Workspace};

/// Arguments for [`EditFile`].
#[derive(Debug, Deserialize, Serialize)]
pub struct EditArgs {
    pub path: String,
    pub old: String,
    pub new: String,
    /// When true, replace every occurrence; otherwise the tool fails if `old`
    /// appears more than once.
    #[serde(default)]
    pub replace_all: bool,
}

/// Exact string substitution in an existing file inside the workspace.
#[derive(Debug, Clone)]
pub struct EditFile {
    workspace: Workspace,
}

impl EditFile {
    /// Construct an `EditFile` bound to the given workspace.
    pub fn new(workspace: Workspace) -> Self {
        Self { workspace }
    }
}

impl Tool for EditFile {
    const NAME: &'static str = "edit_file";
    type Error = ToolError;
    type Args = EditArgs;
    type Output = String;

    fn definition(&self, _prompt: String) -> impl Future<Output = ToolDefinition> + Send {
        let def = ToolDefinition {
            name: "edit_file".to_string(),
            description:
                "Perform an exact string substitution in an existing file inside the \
                 working folder. With replace_all=false (default), the `old` string \
                 MUST appear exactly once; the tool errors out if it is absent, if \
                 it appears more than once, or if `old` equals `new`. With \
                 replace_all=true every occurrence is replaced. Returns the number \
                 of replacements made."
                    .to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Workspace-relative path." },
                    "old": { "type": "string", "description": "Exact text to find (a small unique fragment is best)." },
                    "new": { "type": "string", "description": "Replacement text." },
                    "replace_all": { "type": "boolean", "default": false, "description": "Replace every occurrence." }
                },
                "required": ["path", "old", "new"]
            }),
        };
        async move { def }
    }

    fn call(&self, args: Self::Args) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        let workspace = self.workspace.clone();
        async move {
            if args.old == args.new {
                return Err(ToolError::EditNoop);
            }
            let resolved = workspace.resolve_within(&args.path)?;
            if !resolved.exists() {
                return Err(ToolError::NotFound(args.path));
            }
            if resolved.is_dir() {
                return Err(ToolError::TargetIsDir(args.path));
            }
            let content = std::fs::read_to_string(&resolved)?;
            let path_str = workspace.relative_to_root(&resolved);
            if args.replace_all {
                if !content.contains(&args.old) {
                    return Err(ToolError::EditNotFound { path: path_str });
                }
                let n = content.matches(&args.old).count();
                let new_content = content.replace(&args.old, &args.new);
                std::fs::write(&resolved, new_content)?;
                Ok(format!("replaced {n} occurrence(s) in {path_str}"))
            } else {
                let n = content.matches(&args.old).count();
                match n {
                    0 => Err(ToolError::EditNotFound { path: path_str }),
                    1 => {
                        let new_content = content.replacen(&args.old, &args.new, 1);
                        std::fs::write(&resolved, new_content)?;
                        Ok(format!("replaced 1 occurrence in {path_str}"))
                    }
                    _ => Err(ToolError::EditMultiple { path: path_str, count: n }),
                }
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn ws(d: &TempDir) -> Workspace {
        Workspace::new(d.path())
    }

    #[tokio::test]
    async fn edit_file_single_occurrence() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "hello world").unwrap();
        let e = EditFile::new(ws(&dir));
        let out = e.call(EditArgs {
            path: "a.txt".into(),
            old: "world".into(),
            new: "rust".into(),
            replace_all: false,
        })
        .await
        .unwrap();
        assert!(out.contains("replaced 1 occurrence"));
        assert_eq!(fs::read_to_string(dir.path().join("a.txt")).unwrap(), "hello rust");
    }

    #[tokio::test]
    async fn edit_file_no_occurrence_errors() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "hello").unwrap();
        let e = EditFile::new(ws(&dir));
        let err = e.call(EditArgs {
            path: "a.txt".into(),
            old: "missing".into(),
            new: "x".into(),
            replace_all: false,
        })
        .await
        .unwrap_err();
        assert!(matches!(err, ToolError::EditNotFound { .. }), "{err:?}");
    }

    #[tokio::test]
    async fn edit_file_multiple_without_replace_all_errors() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "one two one two").unwrap();
        let e = EditFile::new(ws(&dir));
        let err = e.call(EditArgs {
            path: "a.txt".into(),
            old: "two".into(),
            new: "2".into(),
            replace_all: false,
        })
        .await
        .unwrap_err();
        assert!(matches!(err, ToolError::EditMultiple { count: 2, .. }), "{err:?}");
        // File untouched on the error.
        assert_eq!(fs::read_to_string(dir.path().join("a.txt")).unwrap(), "one two one two");
    }

    #[tokio::test]
    async fn edit_file_replace_all_replaces_every() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "one two one two").unwrap();
        let e = EditFile::new(ws(&dir));
        let out = e.call(EditArgs {
            path: "a.txt".into(),
            old: "two".into(),
            new: "2".into(),
            replace_all: true,
        })
        .await
        .unwrap();
        assert!(out.contains("replaced 2 occurrence"));
        assert_eq!(fs::read_to_string(dir.path().join("a.txt")).unwrap(), "one 2 one 2");
    }

    #[tokio::test]
    async fn edit_file_noop_when_old_equals_new() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "hello").unwrap();
        let e = EditFile::new(ws(&dir));
        let err = e.call(EditArgs {
            path: "a.txt".into(),
            old: "hello".into(),
            new: "hello".into(),
            replace_all: false,
        })
        .await
        .unwrap_err();
        assert!(matches!(err, ToolError::EditNoop), "{err:?}");
    }
}