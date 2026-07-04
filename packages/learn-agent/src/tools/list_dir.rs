//! `ListDir` — list entries of a directory inside the workspace. Directories
//! are suffixed with `/`. Entries named `node_modules`, `target`, or `.git`
//! are excluded; other dotfile entries (e.g. `.learn`, `.github`, `.env`)
//! ARE listed so the agent can navigate them. Entries are sorted
//! alphabetically.

use futures::Future;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{ToolError, Workspace, LIST_IGNORE};

/// Arguments for [`ListDir`].
#[derive(Debug, Deserialize, Serialize)]
pub struct ListArgs {
    pub path: String,
}

/// Lists entries of a directory inside the workspace.
#[derive(Debug, Clone)]
pub struct ListDir {
    workspace: Workspace,
}

impl ListDir {
    /// Construct a `ListDir` bound to the given workspace.
    pub fn new(workspace: Workspace) -> Self {
        Self { workspace }
    }
}

impl Tool for ListDir {
    const NAME: &'static str = "list_dir";
    type Error = ToolError;
    type Args = ListArgs;
    type Output = String;

    fn definition(&self, _prompt: String) -> impl Future<Output = ToolDefinition> + Send {
        let def = ToolDefinition {
            name: "list_dir".to_string(),
            description:
                "List entries of a directory inside the working folder. \
                 Directories are suffixed with `/`. Entries named \
                 `node_modules`, `target`, or `.git` are excluded; other \
                 dotfile entries (e.g. `.learn`, `.github`, `.env`) ARE \
                 listed so they can be navigated. One entry per line, sorted \
                 alphabetically."
                    .to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Workspace-relative directory path; use \"\" or \".\" for the working folder itself." }
                },
                "required": ["path"]
            }),
        };
        async move { def }
    }

    fn call(&self, args: Self::Args) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        let workspace = self.workspace.clone();
        async move {
            let resolved = if args.path.trim().is_empty() || args.path.trim() == "." {
                workspace.canonical_root()?
            } else {
                workspace.resolve_within(&args.path)?
            };
            if !resolved.exists() {
                return Err(ToolError::NotFound(args.path));
            }
            if !resolved.is_dir() {
                return Err(ToolError::TargetIsFile(args.path));
            }
            let mut entries: Vec<String> = Vec::new();
            for entry in std::fs::read_dir(&resolved)? {
                let entry = entry?;
                let name_os = entry.file_name();
                let name = name_os.to_string_lossy();
                if LIST_IGNORE.iter().any(|ig| ig == &name) {
                    continue;
                }
                let is_dir = entry
                    .file_type()
                    .map(|t| t.is_dir())
                    .unwrap_or(false);
                if is_dir {
                    entries.push(format!("{name}/"));
                } else {
                    entries.push(name.into_owned());
                }
            }
            entries.sort();
            Ok(entries.join("\n"))
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
    async fn list_dir_shows_dotfiles_but_excludes_ignored() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();
        fs::create_dir_all(dir.path().join("node_modules")).unwrap();
        fs::create_dir_all(dir.path().join("target")).unwrap();
        fs::create_dir_all(dir.path().join(".learn")).unwrap();
        fs::create_dir_all(dir.path().join("src")).unwrap();
        fs::write(dir.path().join("Cargo.toml"), b"").unwrap();
        fs::write(dir.path().join(".hidden"), b"").unwrap();
        fs::write(dir.path().join(".env"), b"").unwrap();
        fs::write(dir.path().join(".learn/state.json"), b"").unwrap();
        fs::write(dir.path().join("src/main.rs"), b"").unwrap();
        let l = ListDir::new(ws(&dir));
        let out = l.call(ListArgs { path: "".into() }).await.unwrap();
        let lines: Vec<&str> = out.lines().collect();
        // Regular entries present.
        assert!(lines.contains(&"Cargo.toml"));
        assert!(lines.contains(&"src/"));
        // Dotfile entries now VISIBLE (the agent must reach .learn etc.).
        assert!(lines.contains(&".hidden"));
        assert!(lines.contains(&".env"));
        assert!(lines.contains(&".learn/"));
        // Ignored dirs still excluded.
        assert!(!lines.iter().any(|s| s.contains(".git")));
        assert!(!lines.iter().any(|s| s.contains("node_modules")));
        assert!(!lines.iter().any(|s| s.contains("target")));
        // Sorted: dotfiles sort before uppercase-free entries by byte order
        // ('.' = 0x2e < 'C' = 0x43), so the first line is a dotfile.
        assert!(lines[0].starts_with('.'), "first line should be a dotfile, got {}", lines[0]);
    }

    #[tokio::test]
    async fn list_dir_can_list_inside_dotfile_dir() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join(".learn/sessions")).unwrap();
        fs::write(dir.path().join(".learn/sessions/a.json"), b"").unwrap();
        fs::write(dir.path().join(".learn/sessions/b.json"), b"").unwrap();
        let l = ListDir::new(ws(&dir));
        let out = l.call(ListArgs { path: ".learn/sessions".into() }).await.unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert!(lines.contains(&"a.json"));
        assert!(lines.contains(&"b.json"));
    }

    #[tokio::test]
    async fn list_dir_on_a_file_errors() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), b"x").unwrap();
        let l = ListDir::new(ws(&dir));
        let err = l.call(ListArgs { path: "a.txt".into() }).await.unwrap_err();
        assert!(matches!(err, ToolError::TargetIsFile(_)), "{err:?}");
    }
}