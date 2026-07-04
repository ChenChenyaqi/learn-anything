//! `WriteFile` — write UTF-8 text to a file inside the workspace, creating
//! the file if absent and overwriting if present. Missing parent directories
//! are created. Refuses to overwrite a directory.

use futures::Future;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{ToolError, Workspace};

/// Arguments for [`WriteFile`].
#[derive(Debug, Deserialize, Serialize)]
pub struct WriteArgs {
    pub path: String,
    pub content: String,
}

/// Writes UTF-8 text to a file inside the workspace, creating the file if
/// absent and overwriting if present. Missing parent directories are created.
/// Refuses to overwrite a directory.
#[derive(Debug, Clone)]
pub struct WriteFile {
    workspace: Workspace,
}

impl WriteFile {
    /// Construct a `WriteFile` bound to the given workspace.
    pub fn new(workspace: Workspace) -> Self {
        Self { workspace }
    }
}

impl Tool for WriteFile {
    const NAME: &'static str = "write_file";
    type Error = ToolError;
    type Args = WriteArgs;
    type Output = String;

    fn definition(&self, _prompt: String) -> impl Future<Output = ToolDefinition> + Send {
        let def = ToolDefinition {
            name: "write_file".to_string(),
            description:
                "Write UTF-8 text to a file inside the working folder, creating the \
                 file if it does not exist and overwriting it if it does. Missing \
                 parent directories are created automatically. Refuses to overwrite \
                 a directory."
                    .to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Workspace-relative path." },
                    "content": { "type": "string", "description": "Full file contents to write." }
                },
                "required": ["path", "content"]
            }),
        };
        async move { def }
    }

    fn call(&self, args: Self::Args) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        let workspace = self.workspace.clone();
        async move {
            let resolved = workspace.resolve_within(&args.path)?;
            if resolved.exists() && resolved.is_dir() {
                return Err(ToolError::TargetIsDir(args.path));
            }
            if let Some(parent) = resolved.parent() {
                if !parent.as_os_str().is_empty() {
                    std::fs::create_dir_all(parent)?;
                }
            }
            let bytes = args.content.len();
            std::fs::write(&resolved, args.content)?;
            Ok(format!("wrote {bytes} bytes to {}", workspace.relative_to_root(&resolved)))
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
    async fn write_file_creates_new_with_missing_parents() {
        let dir = TempDir::new().unwrap();
        let w = WriteFile::new(ws(&dir));
        let out = w.call(WriteArgs {
            path: "src/nested/hello.txt".into(),
            content: "hi".into(),
        })
        .await
        .unwrap();
        assert!(out.contains("wrote 2 bytes to src/nested/hello.txt"));
        assert_eq!(fs::read_to_string(dir.path().join("src/nested/hello.txt")).unwrap(), "hi");
    }

    #[tokio::test]
    async fn write_file_overwrites_existing() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "old").unwrap();
        let w = WriteFile::new(ws(&dir));
        w.call(WriteArgs { path: "a.txt".into(), content: "new".into() }).await.unwrap();
        assert_eq!(fs::read_to_string(dir.path().join("a.txt")).unwrap(), "new");
    }

    #[tokio::test]
    async fn write_file_refuses_directory_target() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("d")).unwrap();
        let w = WriteFile::new(ws(&dir));
        let err = w.call(WriteArgs { path: "d".into(), content: "".into() }).await.unwrap_err();
        assert!(matches!(err, ToolError::TargetIsDir(_)), "{err:?}");
    }
}