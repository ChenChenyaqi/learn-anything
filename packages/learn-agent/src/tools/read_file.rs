//! `ReadFile` — read a UTF-8 text file inside the workspace, optionally from
//! a given line offset and for a given line count. Output carries 1-indexed
//! line-number prefixes so the model can cite exact lines back to `EditFile`.
//! Single lines over [`super::READ_LINE_LIMIT`] chars and total output over
//! [`super::READ_FILE_LIMIT`] bytes are truncated with markers.

use futures::Future;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{ToolError, Workspace, READ_FILE_LIMIT, READ_LINE_LIMIT};

/// Arguments for [`ReadFile`].
#[derive(Debug, Deserialize, Serialize)]
pub struct ReadArgs {
    /// Workspace-relative path (or an absolute path inside the working folder).
    pub path: String,
    /// 1-indexed line number to start reading from. Defaults to 1 (the first
    /// line). Values < 1 are treated as 1.
    #[serde(default)]
    pub offset: Option<usize>,
    /// Maximum number of lines to return. Defaults to "to end of file".
    #[serde(default)]
    pub limit: Option<usize>,
}

/// Reads a UTF-8 text file inside the workspace, optionally from a line
/// `offset` for `limit` lines. Output carries 1-indexed line-number prefixes.
#[derive(Debug, Clone)]
pub struct ReadFile {
    workspace: Workspace,
}

impl ReadFile {
    /// Construct a `ReadFile` bound to the given workspace.
    pub fn new(workspace: Workspace) -> Self {
        Self { workspace }
    }
}

impl Tool for ReadFile {
    const NAME: &'static str = "read_file";
    type Error = ToolError;
    type Args = ReadArgs;
    type Output = String;

    fn definition(&self, _prompt: String) -> impl Future<Output = ToolDefinition> + Send {
        let def = ToolDefinition {
            name: "read_file".to_string(),
            description:
                "Read a UTF-8 text file from the working folder. Output is prefixed with \
                 1-indexed line numbers (\"<N>: <content>\") so lines can be cited exactly. \
                 Use `offset` to start from a later line and `limit` to cap how many lines are \
                 returned — essential for large files. Lines longer than 2000 characters are \
                 truncated, and total output over 200 KB is truncated with a marker."
                    .to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Workspace-relative path (e.g. \"src/main.rs\") or \
                                        an absolute path inside the working folder."
                    },
                    "offset": {
                        "type": "integer",
                        "description": "1-indexed line number to start reading from \
                                        (default 1). Use this to continue reading a large file."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of lines to return (default: to end of file)."
                    }
                },
                "required": ["path"]
            }),
        };
        async move { def }
    }

    fn call(&self, args: Self::Args) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        let workspace = self.workspace.clone();
        async move {
            let resolved = workspace.resolve_within(&args.path)?;
            if !resolved.exists() {
                return Err(ToolError::NotFound(args.path));
            }
            if resolved.is_dir() {
                return Err(ToolError::TargetIsDir(args.path));
            }
            let bytes = std::fs::read(&resolved)?;
            let text = String::from_utf8_lossy(&bytes);
            let lines: Vec<&str> = text.lines().collect();
            let total_lines = lines.len();

            // Resolve offset (1-indexed, clamped >= 1).
            let offset = args.offset.unwrap_or(1).max(1);
            if offset > total_lines {
                // Empty file special-case: report it as empty, not "past end".
                if total_lines == 0 {
                    return Ok(String::from("(empty file)"));
                }
                return Ok(format!(
                    "(offset {offset} is past end of file: {total_lines} lines)"
                ));
            }
            let start = offset - 1; // 0-indexed slice start

            // Resolve limit (None = read to end).
            let limit = args
                .limit
                .map(|l| l.min(total_lines.saturating_sub(start)))
                .unwrap_or(total_lines - start);
            let end = start + limit;

            // Build the line-numbered output, truncating over-long single lines.
            let mut out = String::new();
            for (idx, line) in lines[start..end].iter().enumerate() {
                let line_no = start + idx + 1;
                if line.chars().count() > READ_LINE_LIMIT {
                    let truncated: String = line.chars().take(READ_LINE_LIMIT).collect();
                    let full = line.chars().count();
                    out.push_str(&format!(
                        "{line_no}: {truncated} … (line truncated, {full} chars total)\n"
                    ));
                } else {
                    out.push_str(&format!("{line_no}: {line}\n"));
                }
            }
            // Drop the trailing newline left by the last `push_str`.
            if out.ends_with('\n') {
                out.pop();
            }

            // Byte-budget truncation with a marker that points the model at the
            // offset/limit knobs so it can continue reading.
            if out.len() > READ_FILE_LIMIT {
                let mut head = out[..READ_FILE_LIMIT].to_string();
                // Avoid leaving a half-rendered line at the cut.
                if let Some(pos) = head.rfind('\n') {
                    head.truncate(pos);
                }
                head.push_str(&format!(
                    "\n\n[truncated at {READ_FILE_LIMIT} bytes; use a smaller limit or a \
                     higher offset to read the rest]"
                ));
                out = head;
            }

            Ok(out)
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
    async fn read_file_returns_contents_with_line_numbers() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("hello.txt"), b"hello world").unwrap();
        let r = ReadFile::new(ws(&dir));
        let out = r.call(ReadArgs { path: "hello.txt".into(), offset: None, limit: None }).await.unwrap();
        assert_eq!(out, "1: hello world");
    }

    #[tokio::test]
    async fn read_file_offset_and_limit_select_a_range() {
        let dir = TempDir::new().unwrap();
        let body = "l1\nl2\nl3\nl4\nl5";
        fs::write(dir.path().join("f.txt"), body).unwrap();
        let r = ReadFile::new(ws(&dir));
        let out = r
            .call(ReadArgs { path: "f.txt".into(), offset: Some(2), limit: Some(2) })
            .await
            .unwrap();
        // Lines keep their real file line numbers, not a 1-based sequence.
        assert_eq!(out, "2: l2\n3: l3");
    }

    #[tokio::test]
    async fn read_file_limit_without_offset() {
        let dir = TempDir::new().unwrap();
        let body = "a\nb\nc\nd";
        fs::write(dir.path().join("f.txt"), body).unwrap();
        let r = ReadFile::new(ws(&dir));
        let out = r.call(ReadArgs { path: "f.txt".into(), offset: None, limit: Some(2) }).await.unwrap();
        assert_eq!(out, "1: a\n2: b");
    }

    #[tokio::test]
    async fn read_file_offset_past_end_reports_total_lines() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("f.txt"), b"only\none\nline\nhere").unwrap();
        let r = ReadFile::new(ws(&dir));
        let out = r
            .call(ReadArgs { path: "f.txt".into(), offset: Some(99), limit: None })
            .await
            .unwrap();
        assert!(out.contains("offset 99 is past end of file"), "{out}");
        assert!(out.contains("4 lines"), "{out}");
    }

    #[tokio::test]
    async fn read_file_empty_file_reports_empty() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("empty.txt"), b"").unwrap();
        let r = ReadFile::new(ws(&dir));
        let out = r
            .call(ReadArgs { path: "empty.txt".into(), offset: None, limit: None })
            .await
            .unwrap();
        assert_eq!(out, "(empty file)");
    }

    #[tokio::test]
    async fn read_file_truncates_long_single_line() {
        let dir = TempDir::new().unwrap();
        let long = "x".repeat(READ_LINE_LIMIT + 500);
        fs::write(dir.path().join("long.txt"), long.as_bytes()).unwrap();
        let r = ReadFile::new(ws(&dir));
        let out = r.call(ReadArgs { path: "long.txt".into(), offset: None, limit: None }).await.unwrap();
        assert!(out.contains("(line truncated"), "{out}");
        assert!(out.contains("chars total)"), "{out}");
        // The visible body must not exceed the limit + line-number prefix.
        let visible_body = out.lines().next().unwrap();
        assert!(visible_body.len() < READ_LINE_LIMIT + 60, "{}", visible_body.len());
    }

    #[tokio::test]
    async fn read_file_truncates_total_output_above_byte_limit() {
        let dir = TempDir::new().unwrap();
        // Many modest lines that together exceed READ_FILE_LIMIT.
        let line = "a".repeat(1000);
        let body = (0..300).map(|_| line.as_str()).collect::<Vec<_>>().join("\n");
        fs::write(dir.path().join("big.txt"), body.as_bytes()).unwrap();
        let r = ReadFile::new(ws(&dir));
        let out = r.call(ReadArgs { path: "big.txt".into(), offset: None, limit: None }).await.unwrap();
        assert!(out.contains("[truncated at"), "{out}");
        assert!(out.contains("use a smaller limit"), "{out}");
        assert!(out.len() <= READ_FILE_LIMIT + 200, "got {} bytes", out.len());
    }

    #[tokio::test]
    async fn read_file_can_page_through_large_file_with_offset() {
        let dir = TempDir::new().unwrap();
        let body = (1..=10).map(|i| format!("line{i}")).collect::<Vec<_>>().join("\n");
        fs::write(dir.path().join("f.txt"), body).unwrap();
        let r = ReadFile::new(ws(&dir));
        // Page 1.
        let p1 = r.call(ReadArgs { path: "f.txt".into(), offset: Some(1), limit: Some(5) }).await.unwrap();
        assert_eq!(p1, "1: line1\n2: line2\n3: line3\n4: line4\n5: line5");
        // Page 2 continues with correct line numbers.
        let p2 = r.call(ReadArgs { path: "f.txt".into(), offset: Some(6), limit: Some(5) }).await.unwrap();
        assert_eq!(p2, "6: line6\n7: line7\n8: line8\n9: line9\n10: line10");
    }

    #[tokio::test]
    async fn read_file_limit_zero_returns_empty() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("f.txt"), b"a\nb\nc").unwrap();
        let r = ReadFile::new(ws(&dir));
        let out = r.call(ReadArgs { path: "f.txt".into(), offset: None, limit: Some(0) }).await.unwrap();
        assert!(out.is_empty(), "{out}");
    }

    #[tokio::test]
    async fn read_file_missing_errors_notfound() {
        let dir = TempDir::new().unwrap();
        let r = ReadFile::new(ws(&dir));
        let err = r.call(ReadArgs { path: "nope.txt".into(), offset: None, limit: None }).await.unwrap_err();
        assert!(matches!(err, ToolError::NotFound(_)), "{err:?}");
    }

    #[tokio::test]
    async fn read_file_on_a_directory_errors() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();
        let r = ReadFile::new(ws(&dir));
        let err = r.call(ReadArgs { path: "subdir".into(), offset: None, limit: None }).await.unwrap_err();
        assert!(matches!(err, ToolError::TargetIsDir(_)), "{err:?}");
    }
}
