//! `Grep` — search file contents inside the working folder using a regex
//! pattern, optionally limited to a subdirectory and/or file-name glob.
//! Results are `path:line:matched_line` entries, capped at
//! [`super::GREP_RESULT_LIMIT`].
//!
//! ## Two execution paths (per `agent-tools` spec)
//!
//! 1. **ripgrep fast path**: if `rg` is found on `PATH`, the search is delegated
//!    to it (`rg -n --no-heading --no-ignore-vcs --glob '!node_modules' …`).
//!    `--no-ignore-vcs` is set so the agent can search files git would ignore;
//!    the `LIST_IGNORE` dirs (`.git`/`node_modules`/`target`) are excluded
//!    explicitly via `--glob '!…'` to match the pure-Rust path's pruning.
//! 2. **pure-Rust fallback**: if `rg` is unavailable, returns an error, or the
//!    process exits with code 2 (rg's own error), we fall back to a recursive
//!    [`walk_files`] + [`Regex`] scan. This keeps the tool functional on
//!    systems without ripgrep and is the source of truth for behavior the rg
//!    path must mirror.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;

use futures::Future;
use regex::Regex;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::process::Command;

use super::{ToolError, Workspace, GREP_RESULT_LIMIT, LIST_IGNORE};

/// Arguments for [`Grep`].
#[derive(Debug, Deserialize, Serialize)]
pub struct GrepArgs {
    /// Regex pattern (Rust-regex syntax; ripgrep accepts the same).
    pub pattern: String,
    /// Workspace-relative subdirectory to search. Defaults to the working folder.
    #[serde(default)]
    pub path: Option<String>,
    /// Optional file-name glob (e.g. `*.rs`) restricting files scanned.
    #[serde(default)]
    pub include: Option<String>,
}

/// Searches file contents inside the working folder using a regex pattern.
#[derive(Debug, Clone)]
pub struct Grep {
    workspace: Workspace,
}

impl Grep {
    /// Construct a `Grep` bound to the given workspace.
    pub fn new(workspace: Workspace) -> Self {
        Self { workspace }
    }
}

impl Tool for Grep {
    const NAME: &'static str = "grep";
    type Error = ToolError;
    type Args = GrepArgs;
    type Output = String;

    fn definition(&self, _prompt: String) -> impl Future<Output = ToolDefinition> + Send {
        let def = ToolDefinition {
            name: "grep".to_string(),
            description:
                "Search file contents inside the working folder using a regex \
                 pattern (Rust regex syntax). Outputs `path:line:matched_line` \
                 entries, up to 100 results — when the cap is hit a trailing \
                 note says so. Optionally limited to a subdirectory and/or a \
                 file-name glob (e.g. \"*.rs\"). Searches dotfile directories \
                 like `.learn` and `.github`; only `.git`, `node_modules`, \
                 and `target` are skipped. Uses ripgrep when available and \
                 falls back to a built-in regex walk otherwise."
                    .to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "pattern": { "type": "string", "description": "Regex pattern." },
                    "path": { "type": "string", "description": "Optional subdirectory (workspace-relative) to search. Defaults to the whole working folder." },
                    "include": { "type": "string", "description": "Optional file-name glob (e.g. \"*.rs\") restricting scanned files." }
                },
                "required": ["pattern"]
            }),
        };
        async move { def }
    }

    fn call(&self, args: Self::Args) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        let workspace = self.workspace.clone();
        async move {
            let root: PathBuf = match args.path.as_deref().map(str::trim) {
                None | Some("") | Some(".") => workspace.canonical_root()?,
                Some(p) => workspace.resolve_within(p)?,
            };
            if !root.exists() {
                return Err(ToolError::NotFound(args.path.unwrap_or_default()));
            }
            if !root.is_dir() {
                return Err(ToolError::TargetIsFile(args.path.unwrap_or_default()));
            }

            // Validate the regex up front so an invalid pattern errors the same
            // way on both paths (and before we spend a process spawn on rg).
            let re = Regex::new(&args.pattern)?;

            // Fast path: delegate to ripgrep when available.
            if rg_available() {
                if let Some(out) = try_rgrep(&args, &root).await? {
                    return Ok(out);
                }
                // rg ran but signaled an internal error (exit 2) → fall through
                // to the pure-Rust walk.
            }

            // Fallback: pure-Rust recursive walk.
            let include_re = match args.include.as_deref() {
                Some(s) if !s.is_empty() => Some(glob_to_regex(s)?),
                _ => None,
            };
            let mut results: Vec<String> = Vec::new();
            let mut capped = false;
            walk_files(&root, &mut |abs_path| {
                if capped {
                    return;
                }
                if let Some(re_inc) = &include_re {
                    let name = abs_path
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_default();
                    if !re_inc.is_match(&name) {
                        return;
                    }
                }
                let content = match std::fs::read_to_string(abs_path) {
                    Ok(c) => c,
                    Err(_) => return,
                };
                for (i, line) in content.lines().enumerate() {
                    if re.is_match(line) {
                        let rel = workspace.relative_to_root(abs_path);
                        results.push(format!("{rel}:{}:{}", i + 1, line));
                        if results.len() >= GREP_RESULT_LIMIT {
                            capped = true;
                            break;
                        }
                    }
                }
            });

            if results.is_empty() {
                return Ok(String::from("(no matches)"));
            }
            let mut out = results.join("\n");
            if capped {
                out.push_str(&format!("\n[truncated: {} result cap reached]", GREP_RESULT_LIMIT));
            }
            Ok(out)
        }
    }
}

/* ------------------------------------------------------------------ */
/*  ripgrep fast path                                                  */
/* ------------------------------------------------------------------ */

/// Detect ripgrep once and cache the result. Probing is synchronous (a bare
/// `rg --version` status check) and happens at most once per process.
fn rg_available() -> bool {
    static AVAIL: OnceLock<bool> = OnceLock::new();
    *AVAIL.get_or_init(|| {
        std::process::Command::new("rg")
            .arg("--version")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
    })
}

/// Run ripgrep against `root` and format its output like the pure-Rust path.
///
/// Returns `Ok(Some(formatted))` on a decisive rg outcome (matches or
/// no-matches), `Ok(None)` when rg itself errored (exit code 2) and the caller
/// should fall back to the built-in walk, and `Err` only on spawn/IO failure
/// of the rg process (which also triggers fallback at the call site).
async fn try_rgrep(args: &GrepArgs, root: &Path) -> Result<Option<String>, ToolError> {
    let mut cmd = Command::new("rg");
    cmd.current_dir(root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("-n")
        .arg("--no-heading")
        .arg("--color")
        .arg("never")
        // Search files git would ignore AND hidden (dotfile) directories — the
        // agent must reach `.learn`, `.github`, build artifacts, etc. The
        // LIST_IGNORE dirs are still excluded explicitly below so we mirror
        // the pure-Rust path's pruning (rg would otherwise descend into
        // `.git` once `--hidden` is on).
        .arg("--no-ignore-vcs")
        .arg("--hidden");
    for ignored in LIST_IGNORE {
        cmd.arg("--glob").arg(format!("!{ignored}"));
    }
    if let Some(inc) = args.include.as_deref().filter(|s| !s.is_empty()) {
        cmd.arg("--glob").arg(inc);
    }
    // `-e` guards against patterns that begin with `-`.
    cmd.arg("-e").arg(&args.pattern).arg(".");

    let output = match cmd.output().await {
        Ok(o) => o,
        // Spawn failure (e.g. rg vanished between probe and call) → fallback.
        Err(_) => return Ok(None),
    };

    // rg exit codes: 0 = matches, 1 = no matches, 2 = error. Only code 2
    // signals "rg could not run this query"; treat it as "use the fallback".
    if output.status.code() == Some(2) {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // rg prints `./rel/path:line:content` when searching `.`; normalize the
    // prefix so output matches the pure-Rust path exactly.
    let mut results: Vec<String> = Vec::new();
    for line in stdout.lines() {
        let stripped = line.strip_prefix("./").unwrap_or(line);
        results.push(stripped.to_string());
        if results.len() >= GREP_RESULT_LIMIT {
            break;
        }
    }
    if results.is_empty() {
        return Ok(Some(String::from("(no matches)")));
    }
    let mut out = results.join("\n");
    // Only claim truncation if rg actually had more rows than the cap.
    if results.len() >= GREP_RESULT_LIMIT && stdout.lines().count() > GREP_RESULT_LIMIT {
        out.push_str(&format!("\n[truncated: {} result cap reached]", GREP_RESULT_LIMIT));
    }
    Ok(Some(out))
}

/* ------------------------------------------------------------------ */
/*  Local helpers (pure-Rust fallback)                                 */
/* ------------------------------------------------------------------ */

/// Recursively walk files under `root` (no follow-symlinks), invoking `cb`
/// for each regular file. Directories in [`LIST_IGNORE`] (`.git`,
/// `node_modules`, `target`) are skipped; other dotfile directories (e.g.
/// `.learn`, `.github`) ARE walked so the agent can search them.
fn walk_files(root: &Path, cb: &mut dyn FnMut(&Path)) {
    let Ok(entries) = std::fs::read_dir(root) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            if LIST_IGNORE.iter().any(|ig| ig == &name) {
                continue;
            }
            walk_files(&path, cb);
        } else if ft.is_file() {
            cb(&path);
        }
    }
}

/// Convert a simple file-name glob (`*.rs`, `Cargo.toml`, `*.test.*`) into a
/// regex anchored to match the whole file name. `*` matches any run of non-`/`
/// chars; `?` matches a single non-`/` char. Regex meta-characters in the
/// literal portions are escaped.
fn glob_to_regex(glob: &str) -> Result<Regex, regex::Error> {
    const META: &str = r"\.+*?()[]{}|^$";
    let mut out = String::with_capacity(glob.len() + 8);
    out.push('^');
    for ch in glob.chars() {
        match ch {
            '*' => out.push_str("[^/]*"),
            '?' => out.push_str("[^/]"),
            c if META.contains(c) => {
                out.push('\\');
                out.push(c);
            }
            c => out.push(c),
        }
    }
    out.push('$');
    Regex::new(&out)
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
    async fn grep_finds_matches() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.rs"), "fn alpha() {}\nfn beta() {}\n").unwrap();
        fs::write(dir.path().join("b.rs"), "fn gamma() {}\n").unwrap();
        let g = Grep::new(ws(&dir));
        let out = g.call(GrepArgs {
            pattern: "fn".into(),
            path: None,
            include: Some("*.rs".into()),
        })
        .await
        .unwrap();
        assert!(out.contains("a.rs:1:fn alpha() {}"));
        assert!(out.contains("a.rs:2:fn beta() {}"));
        assert!(out.contains("b.rs:1:fn gamma() {}"));
    }

    #[tokio::test]
    async fn grep_no_match_returns_indicator() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.rs"), "fn alpha() {}\n").unwrap();
        let g = Grep::new(ws(&dir));
        let out = g.call(GrepArgs { pattern: "absent".into(), path: None, include: None }).await.unwrap();
        assert_eq!(out, "(no matches)");
    }

    #[tokio::test]
    async fn grep_caps_results() {
        let dir = TempDir::new().unwrap();
        let mut big = String::new();
        for i in 0..(GREP_RESULT_LIMIT + 20) {
            big.push_str(&format!("hit{i}\n"));
        }
        fs::write(dir.path().join("big.txt"), big).unwrap();
        let g = Grep::new(ws(&dir));
        let out = g.call(GrepArgs { pattern: "hit".into(), path: None, include: None }).await.unwrap();
        let lines = out.lines().count();
        assert!(out.contains("[truncated: "));
        assert_eq!(lines, GREP_RESULT_LIMIT + 1);
    }

    #[tokio::test]
    async fn grep_searches_dotfile_directories() {
        let dir = TempDir::new().unwrap();
        // `.learn` must be searchable by the agent; `.git` must still be skipped.
        fs::create_dir_all(dir.path().join(".learn/sessions")).unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join(".learn/sessions/a.json"), "{\"topic\": \"rust\"}\n").unwrap();
        fs::write(dir.path().join(".git/COMMIT_EDITMSG"), "topic should NOT match\n").unwrap();
        let g = Grep::new(ws(&dir));
        let out = g.call(GrepArgs { pattern: "topic".into(), path: None, include: None }).await.unwrap();
        // Match inside `.learn` is found…
        assert!(out.contains(".learn/sessions/a.json:1:"), "{out}");
        // …but `.git` is skipped entirely.
        assert!(!out.contains("COMMIT_EDITMSG"), "{out}");
    }

    /// When ripgrep is installed, the fast path is used AND it honors the
    /// LIST_IGNORE exclusion (target must not appear). Skipped when rg is
    /// absent so the suite stays green on minimal CI runners.
    #[tokio::test]
    async fn grep_ripgrep_path_excludes_ignored_dirs() {
        if !rg_available() {
            eprintln!("skipping: ripgrep not installed");
            return;
        }
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("target")).unwrap();
        fs::write(dir.path().join("target/gen.rs"), "fn match_me() {}\n").unwrap();
        fs::write(dir.path().join("real.rs"), "fn match_me() {}\n").unwrap();
        let g = Grep::new(ws(&dir));
        let out = g.call(GrepArgs { pattern: "match_me".into(), path: None, include: None }).await.unwrap();
        assert!(out.contains("real.rs:1:fn match_me"), "{out}");
        assert!(!out.contains("target/gen.rs"), "ripgrep path must exclude target: {out}");
    }

    /// An invalid regex errors the same way on both paths.
    #[tokio::test]
    async fn grep_invalid_regex_errors() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.rs"), "x").unwrap();
        let g = Grep::new(ws(&dir));
        let err = g.call(GrepArgs { pattern: "(".into(), path: None, include: None }).await.unwrap_err();
        assert!(matches!(err, ToolError::Regex(_)), "{err:?}");
    }

    #[test]
    fn glob_to_regex_matches_star() {
        let re = glob_to_regex("*.rs").unwrap();
        assert!(re.is_match("main.rs"));
        assert!(!re.is_match("dir/main.rs"), "name-only glob doesn't match paths");
        assert!(!re.is_match("Cargo.toml"));
    }

    #[test]
    fn glob_to_regex_matches_question_mark() {
        let re = glob_to_regex("?.txt").unwrap();
        assert!(re.is_match("a.txt"));
        assert!(!re.is_match("ab.txt"));
    }
}