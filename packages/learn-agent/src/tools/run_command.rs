//! `RunCommand` — run a command (with explicit args, no shell) with `cwd`
//! set to the working folder. stdout and stderr are captured **concurrently**
//! (via `tokio::join!`) to avoid the classic pipe-deadlock where one full
//! stream blocks the child while we block reading the other. Each stream is
//! reported with the first [`super::RUN_CMD_STREAM_LIMIT`] bytes plus the
//! original total byte count (so truncation is visible to the model). A
//! wall-clock timeout (default 120s, constructor-injectable for tests) kills
//! the child on exceedance via `kill_on_drop`.

use std::process::Stdio;
use std::time::Duration;

use futures::Future;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;

use super::{ToolError, Workspace, RUN_CMD_STREAM_LIMIT};

/// Default wall-clock timeout when not overridden via [`RunCommand::with_timeout`].
const DEFAULT_TIMEOUT_SECS: u64 = 120;

/// Arguments for [`RunCommand`].
#[derive(Debug, Deserialize, Serialize)]
pub struct RunCommandArgs {
    /// Executable to run (no shell; e.g. `cargo`, `node`, `git`).
    pub command: String,
    /// Explicit argument strings. Never shell-interpolated.
    #[serde(default)]
    pub args: Vec<String>,
}

/// Runs a command inside the working folder with stdout/stderr capture and a
/// timeout.
#[derive(Debug, Clone)]
pub struct RunCommand {
    workspace: Workspace,
    timeout: Duration,
}

impl RunCommand {
    /// Construct a `RunCommand` bound to the given workspace with the default
    /// 120s timeout.
    pub fn new(workspace: Workspace) -> Self {
        Self {
            workspace,
            timeout: Duration::from_secs(DEFAULT_TIMEOUT_SECS),
        }
    }

    /// Construct a `RunCommand` with a custom wall-clock timeout in seconds.
    /// Used by tests to run the timeout case in well under a second instead
    /// of blocking for 120s — avoids relying on a process-global env var,
    /// which is unsafe under parallel `cargo test` (env vars are shared
    /// across all test threads in the process).
    pub fn with_timeout(workspace: Workspace, secs: u64) -> Self {
        Self {
            workspace,
            timeout: Duration::from_secs(secs),
        }
    }
}

impl Tool for RunCommand {
    const NAME: &'static str = "run_command";
    type Error = ToolError;
    type Args = RunCommandArgs;
    type Output = String;

    fn definition(&self, _prompt: String) -> impl Future<Output = ToolDefinition> + Send {
        let def = ToolDefinition {
            name: "run_command".to_string(),
            description:
                "Run a command inside the working folder. The command is invoked \
                 directly (NOT through a shell) with explicit arguments, so pass \
                 args as a list. cwd is set to the working folder. stdout/stderr \
                 are returned truncated at 4 KB each, with the original byte count \
                 noted when truncated. A 120-second timeout is enforced; the \
                 command is killed on timeout."
                    .to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "Executable name or path (e.g. \"cargo\", \"node\", \"git\")." },
                    "args": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Arguments, each as a separate string (no shell interpolation).",
                        "default": []
                    }
                },
                "required": ["command"]
            }),
        };
        async move { def }
    }

    fn call(&self, args: Self::Args) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        let workspace = self.workspace.clone();
        let timeout = self.timeout;
        async move {
            // cwd is the workspace root by spec, not user-selectable.
            let cwd = workspace.canonical_root()?;

            // `kill_on_drop(true)` ensures that if our timeout future is
            // dropped (on timeout) the child is reaped rather than orphaned.
            let mut cmd = Command::new(&args.command);
            cmd.args(&args.args)
                .current_dir(&cwd)
                .stdin(Stdio::null())
                .kill_on_drop(true);

            let mut child = match cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn() {
                Ok(c) => c,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    return Err(ToolError::CommandNotFound(args.command.clone()))
                }
                Err(e) => return Err(ToolError::CommandSpawn(e.to_string())),
            };
            let mut stdout = child.stdout.take();
            let mut stderr = child.stderr.take();

            // Inner future: drain both streams concurrently, then wait.
            // Reading both to EOF in parallel is what avoids the pipe-deadlock:
            // if we read serially, a full stdout pipe (~64 KB OS buffer) blocks
            // the child's writes while we block reading stderr, and neither
            // progresses until our timeout kills the child. With `tokio::join!`
            // both pipes drain simultaneously.
            let run = async {
                let (out_res, err_res) = tokio::join!(
                    async {
                        match stdout.as_mut() {
                            Some(s) => read_to_limit(s, RUN_CMD_STREAM_LIMIT).await,
                            None => Ok((String::new(), 0)),
                        }
                    },
                    async {
                        match stderr.as_mut() {
                            Some(s) => read_to_limit(s, RUN_CMD_STREAM_LIMIT).await,
                            None => Ok((String::new(), 0)),
                        }
                    },
                );
                let (out_text, out_total) = out_res?;
                let (err_text, err_total) = err_res?;
                // Both pipes drained to EOF → `wait` cannot deadlock.
                let status = child.wait().await?;
                let code = status
                    .code()
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| "signal".into());
                Ok::<_, ToolError>(format!(
                    "exit: {code}\n--- stdout ---\n{}\n--- stderr ---\n{}",
                    with_truncation_marker(&out_text, out_total, RUN_CMD_STREAM_LIMIT),
                    with_truncation_marker(&err_text, err_total, RUN_CMD_STREAM_LIMIT),
                ))
            };

            match tokio::time::timeout(timeout, run).await {
                Ok(inner) => inner,
                // On timeout the `run` future (and thus `child`) is dropped;
                // `kill_on_drop(true)` reaps the process.
                Err(_) => Err(ToolError::CommandTimeout(args.command)),
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Local helpers                                                      */
/* ------------------------------------------------------------------ */

/// Read `r` fully to EOF, keeping only the first `limit` bytes and counting
/// the total number of bytes seen. Returns the kept text and the original
/// total. Reading to EOF (not stopping at `limit`) is deliberate: it keeps
/// the child's pipe from filling and lets the caller report the true size.
async fn read_to_limit<R: AsyncRead + Unpin>(
    r: &mut R,
    limit: usize,
) -> Result<(String, usize), ToolError> {
    let mut kept: Vec<u8> = Vec::new();
    let mut total: usize = 0;
    let mut chunk = vec![0u8; 8192];
    loop {
        let n = r.read(&mut chunk).await?;
        if n == 0 {
            break;
        }
        total += n;
        if kept.len() < limit {
            let room = limit - kept.len();
            let take = n.min(room);
            kept.extend_from_slice(&chunk[..take]);
        }
    }
    Ok((String::from_utf8_lossy(&kept).into_owned(), total))
}

/// Append a `[truncated: original was N bytes]` marker when the stream's
/// original size exceeded `limit`; otherwise return the text unchanged.
fn with_truncation_marker(text: &str, total: usize, limit: usize) -> String {
    if total > limit {
        format!("{text}\n[truncated: original was {total} bytes]")
    } else {
        text.to_string()
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
    async fn run_command_fast_exit_zero() {
        let dir = TempDir::new().unwrap();
        let r = RunCommand::new(ws(&dir));
        // `true` is a no-op successful command on unix.
        let out = r.call(RunCommandArgs { command: "true".into(), args: vec![] }).await.unwrap();
        assert!(out.contains("exit: 0"));
    }

    #[tokio::test]
    async fn run_command_nonexistent_executable() {
        let dir = TempDir::new().unwrap();
        let r = RunCommand::new(ws(&dir));
        let err = r.call(RunCommandArgs { command: "definitely-not-a-real-binary-xyz".into(), args: vec![] }).await.unwrap_err();
        assert!(matches!(err, ToolError::CommandNotFound(_)), "{err:?}");
    }

    #[tokio::test]
    async fn run_command_truncates_large_stdout() {
        let dir = TempDir::new().unwrap();
        let r = RunCommand::new(ws(&dir));
        // `seq` writes one number per line; 10000 lines produces ~49 KB, well
        // past the 4 KB cap. It terminates on its own so the test is fast.
        let out = r.call(RunCommandArgs {
            command: "seq".into(),
            args: vec!["1".into(), "10000".into()],
        })
        .await
        .unwrap();
        // The marker now reports the ORIGINAL total byte count (not the cap).
        assert!(out.contains("[truncated: original was "), "{out}");
        assert!(out.contains("exit: 0"), "{out}");
    }

    #[tokio::test]
    async fn run_command_times_out() {
        // Constructor-injected tiny timeout → runs in well under a second,
        // no process-global env var (safe under parallel `cargo test`).
        let dir = TempDir::new().unwrap();
        let r = RunCommand::with_timeout(ws(&dir), 1);
        let err = r.call(RunCommandArgs { command: "sleep".into(), args: vec!["30".into()] }).await.unwrap_err();
        assert!(matches!(err, ToolError::CommandTimeout(_)), "{err:?}");
    }

    #[tokio::test]
    async fn run_command_runs_in_working_folder() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("marker.txt"), b"present").unwrap();
        let r = RunCommand::new(ws(&dir));
        let out = r.call(RunCommandArgs {
            command: "ls".into(),
            args: vec!["marker.txt".into()],
        })
        .await
        .unwrap();
        assert!(out.contains("marker.txt"), "{out}");
    }

    /// Regression test for the pipe-deadlock: a command that writes MORE than
    /// the OS pipe buffer (~64 KB) to stdout must not hang until timeout. Before
    /// the concurrent-read fix this would block until the 120s timeout killed
    /// the child; now it completes in well under a second because both pipes
    /// drain concurrently. (stderr here is empty, but the join! still proves
    /// we don't serialize-read into a full pipe.)
    #[tokio::test]
    async fn run_command_does_not_deadlock_on_large_stdout() {
        let dir = TempDir::new().unwrap();
        let r = RunCommand::with_timeout(ws(&dir), 10);
        // Write ~200 KB to stdout — well past the 64 KB OS pipe buffer.
        let out = r.call(RunCommandArgs {
            command: "seq".into(),
            args: vec!["1".into(), "60000".into()],
        })
        .await
        .unwrap();
        assert!(out.contains("exit: 0"), "command should finish, not time out: {out}");
        assert!(out.contains("[truncated: original was "), "{out}");
    }
}