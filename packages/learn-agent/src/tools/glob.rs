//! `Glob` — return file paths inside the working folder matching a glob
//! pattern, recursively. Results are workspace-relative, sorted
//! alphabetically, capped at [`super::GLOB_RESULT_LIMIT`].
//!
//! Unlike a raw `glob::glob` traversal, this walker prunes the
//! [`super::LIST_IGNORE`] directories (`.git`, `node_modules`, `target`) so a
//! pattern like `**/*.rs` in a real project does not return thousands of
//! build-artifact paths and exhaust the cap with noise. Dotfile directories
//! the agent legitimately needs (`.learn`, `.github`, `.vscode`) ARE walked.

use std::path::{Path, PathBuf};

use futures::Future;
use glob::Pattern;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{ToolError, Workspace, GLOB_RESULT_LIMIT, LIST_IGNORE};

/// Arguments for [`Glob`].
#[derive(Debug, Deserialize, Serialize)]
pub struct GlobArgs {
    /// Glob pattern (supports `**` recursion; e.g. `**/Cargo.toml`).
    pub pattern: String,
    /// Workspace-relative base directory. Defaults to the working folder.
    #[serde(default)]
    pub path: Option<String>,
}

/// Returns file paths inside the working folder matching a glob pattern.
#[derive(Debug, Clone)]
pub struct Glob {
    workspace: Workspace,
}

impl Glob {
    /// Construct a `Glob` bound to the given workspace.
    pub fn new(workspace: Workspace) -> Self {
        Self { workspace }
    }
}

impl Tool for Glob {
    const NAME: &'static str = "glob";
    type Error = ToolError;
    type Args = GlobArgs;
    type Output = String;

    fn definition(&self, _prompt: String) -> impl Future<Output = ToolDefinition> + Send {
        let def = ToolDefinition {
            name: "glob".to_string(),
            description:
                "Return file paths inside the working folder that match a glob \
                 pattern (supports `**` recursion). Hidden (dotfile) \
                 directories and files ARE included, so patterns like \
                 `.learn/**/*.json` work; `.git`, `node_modules`, and `target` \
                 are skipped. Results are workspace-relative, sorted \
                 alphabetically, capped at 500."
                    .to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "pattern": { "type": "string", "description": "Glob pattern, e.g. \"**/Cargo.toml\"." },
                    "path": { "type": "string", "description": "Workspace-relative base directory; defaults to the working folder root." }
                },
                "required": ["pattern"]
            }),
        };
        async move { def }
    }

    fn call(&self, args: Self::Args) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        let workspace = self.workspace.clone();
        async move {
            let base: PathBuf = match args.path.as_deref().map(str::trim) {
                None | Some("") | Some(".") => workspace.canonical_root()?,
                Some(p) => workspace.resolve_within(p)?,
            };
            if !base.exists() {
                return Err(ToolError::NotFound(args.path.unwrap_or_default()));
            }
            if !base.is_dir() {
                return Err(ToolError::TargetIsFile(args.path.unwrap_or_default()));
            }
            // Parse the pattern once; match each walked file's
            // workspace-relative path against it. `Pattern` understands `**`.
            let pattern = Pattern::new(&args.pattern)?;

            let mut paths: Vec<String> = Vec::new();
            walk_and_match(
                &base,
                &pattern,
                &workspace,
                &mut paths,
                GLOB_RESULT_LIMIT,
            );

            paths.sort();
            Ok(if paths.is_empty() {
                String::from("(no matches)")
            } else {
                paths.join("\n")
            })
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Local walker                                                       */
/* ------------------------------------------------------------------ */

/// Recursively walk `root`, prune [`LIST_IGNORE`] directories, and collect
/// workspace-relative paths of regular files whose relative path matches
/// `pattern`. Stops once `out` reaches `cap`. Dotfile directories (e.g.
/// `.learn`) ARE descended into; only the LIST_IGNORE set is pruned.
fn walk_and_match(
    root: &Path,
    pattern: &Pattern,
    workspace: &Workspace,
    out: &mut Vec<String>,
    cap: usize,
) {
    let Ok(entries) = std::fs::read_dir(root) else { return };
    for entry in entries.flatten() {
        if out.len() >= cap {
            return;
        }
        let path = entry.path();
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            if LIST_IGNORE.iter().any(|ig| ig == &name) {
                continue;
            }
            walk_and_match(&path, pattern, workspace, out, cap);
        } else if ft.is_file() {
            let rel = workspace.relative_to_root(&path);
            if pattern.matches_path(Path::new(&rel)) {
                out.push(rel);
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
    async fn glob_matches_recursive_pattern() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("src")).unwrap();
        fs::write(dir.path().join("Cargo.toml"), b"").unwrap();
        fs::write(dir.path().join("src/main.rs"), b"").unwrap();
        fs::write(dir.path().join("src/lib.rs"), b"").unwrap();
        let gl = Glob::new(ws(&dir));
        let out = gl.call(GlobArgs { pattern: "**/*.rs".into(), path: None }).await.unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert!(lines.contains(&"src/lib.rs"));
        assert!(lines.contains(&"src/main.rs"));
        assert!(!lines.iter().any(|s| s.contains("Cargo.toml")));
        // Sorted.
        assert_eq!(lines[0], "src/lib.rs");
    }

    #[tokio::test]
    async fn glob_caps_at_limit() {
        let dir = TempDir::new().unwrap();
        for i in 0..(GLOB_RESULT_LIMIT + 10) {
            fs::write(dir.path().join(format!("f{i}.txt")), b"").unwrap();
        }
        let gl = Glob::new(ws(&dir));
        let out = gl.call(GlobArgs { pattern: "*.txt".into(), path: None }).await.unwrap();
        let lines = out.lines().count();
        assert_eq!(lines, GLOB_RESULT_LIMIT);
    }

    #[tokio::test]
    async fn glob_matches_files_inside_dotfile_dirs() {
        let dir = TempDir::new().unwrap();
        // `.learn/sessions/*.json` is the canonical layout the agent must reach.
        fs::create_dir_all(dir.path().join(".learn/sessions")).unwrap();
        fs::create_dir_all(dir.path().join(".github")).unwrap();
        fs::write(dir.path().join(".learn/sessions/abc.json"), b"").unwrap();
        fs::write(dir.path().join(".learn/sessions/def.json"), b"").unwrap();
        fs::write(dir.path().join(".github/workflows.yml"), b"").unwrap();
        let gl = Glob::new(ws(&dir));

        // `**` recursion descends into dotfile directories.
        let out = gl.call(GlobArgs { pattern: "**/*.json".into(), path: None }).await.unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert!(lines.contains(&".learn/sessions/abc.json"), "{out}");
        assert!(lines.contains(&".learn/sessions/def.json"), "{out}");
        assert_eq!(lines.len(), 2, "only the two .learn json files should match: {out}");

        // An explicit dotfile pattern works too.
        let out2 = gl.call(GlobArgs { pattern: ".learn/**/*.json".into(), path: None }).await.unwrap();
        let lines2: Vec<&str> = out2.lines().collect();
        assert!(lines2.contains(&".learn/sessions/abc.json"), "{out2}");
    }

    /// Regression: ignored dirs (`target`, `node_modules`, `.git`) must NOT
    /// pollute glob results, even with a broad `**` pattern. Before the custom
    /// walker this returned build-artifact paths and exhausted the cap.
    #[tokio::test]
    async fn glob_excludes_ignored_dirs() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("target/debug")).unwrap();
        fs::create_dir_all(dir.path().join("node_modules/pkg")).unwrap();
        fs::create_dir_all(dir.path().join(".git/objects")).unwrap();
        fs::create_dir_all(dir.path().join("src")).unwrap();
        // Real source file the agent wants.
        fs::write(dir.path().join("src/main.rs"), b"").unwrap();
        // Noise that must be excluded.
        fs::write(dir.path().join("target/debug/main.rs"), b"").unwrap();
        fs::write(dir.path().join("node_modules/pkg/main.rs"), b"").unwrap();
        fs::write(dir.path().join(".git/objects/main.rs"), b"").unwrap();
        let gl = Glob::new(ws(&dir));
        let out = gl.call(GlobArgs { pattern: "**/*.rs".into(), path: None }).await.unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert_eq!(lines, vec!["src/main.rs"], "ignored dirs must be pruned: {out}");
    }

    #[tokio::test]
    async fn glob_top_level_star_matches_dotfiles() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join(".env"), b"").unwrap();
        fs::write(dir.path().join("Cargo.toml"), b"").unwrap();
        let gl = Glob::new(ws(&dir));
        // A bare `*` matches dotfiles too with our walker (no leading-dot rule).
        let out = gl.call(GlobArgs { pattern: "*".into(), path: None }).await.unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert!(lines.contains(&".env"), "dotfiles must be reachable: {out}");
        assert!(lines.contains(&"Cargo.toml"), "{out}");
    }
}