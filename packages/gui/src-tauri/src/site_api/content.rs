//! File-content reader — ported from `serve.mjs::serveFileContent`.
//!
//! Input is an "API path" like `/topics/javascript/sessions/foo.md`; the
//! `/topics/` prefix is stripped and the remainder is joined onto
//! `topics_dir`. Path traversal is blocked twice:
//!   1. the relative part must not contain `..` (the same loose check as
//!      `serve.mjs` — substring, not component — because `serve.mjs`'s only
//!      consumers send already-sanitized paths);
//!   2. the canonicalized target must remain inside the canonicalized
//!      `topics_dir`.
//!
//! Non-UTF-8 files are lossy-converted to `String`, matching Node's
//! `readFileSync(p, 'utf-8')` (which substitutes `U+FFFD`).

use std::path::Path;

/// Result of resolving an API path. `Ok(Some)` = file hit & readable.
/// `Ok(None)` = no such file (or the API path didn't start with `/topics/`).
/// `Err(())` = path traversal attempted (`forbidden`).
pub(super) type ContentResult = Result<Option<String>, ()>;

/// Outcome of a note write, mirroring `ContentResult`'s HTTP-like semantics
/// (mapped to codes by the command layer).
#[derive(PartialEq, Eq, Debug)]
pub(super) enum WriteOutcome {
    /// Content written and renamed into place.
    Written,
    /// Target file (or the topics dir) doesn't exist — creating files is not
    /// supported by this command, so this maps to 404.
    NotFound,
    /// Traversal / symlink escape / non-`.md` target — maps to 403.
    Forbidden,
}

/// Strip `/topics/` and reject traversal.
///
/// Returns:
/// - `Ok(Some(rest))` — well-formed API path with a non-empty remainder.
/// - `Ok(None)` — the path didn't start with `/topics/` (or was just
///   `/topics/`); mapped to **404** by the caller, matching `serve.mjs`'s
///   `if (!match) { 404 }`.
/// - `Err(())` — the remainder contains `..` (substring check, same as
///   `serve.mjs`'s `relativePart.includes('..')`); mapped to **403**.
pub(super) fn parse_api_path(api_path: &str) -> Result<Option<String>, ()> {
    let Some(rest) = api_path.strip_prefix("/topics/") else {
        return Ok(None);
    };
    if rest.is_empty() {
        return Ok(None);
    }
    if rest.contains("..") {
        return Err(());
    }
    Ok(Some(rest.to_string()))
}

/// Look up and read the file pointed at by `api_path`.
pub(super) fn read_file_content(api_path: &str, topics_dir: &Path) -> ContentResult {
    let Some(rest) = parse_api_path(api_path)? else {
        return Ok(None);
    };
    let candidate_raw = topics_dir.join(&rest);
    // If topics_dir itself doesn't exist, canonicalizing fails; treat as 404.
    let Ok(base_canon) = topics_dir.canonicalize() else {
        return Ok(None);
    };
    let Some(target_canon) = candidate_raw.canonicalize().ok() else {
        return Ok(None);
    };
    if !target_canon.starts_with(&base_canon) {
        return Err(()); // forbidden
    }
    match std::fs::read(&target_canon) {
        Ok(bytes) => Ok(Some(String::from_utf8_lossy(&bytes).into_owned())),
        Err(_) => Ok(None),
    }
}

/// Overwrite the markdown note at `api_path` with `contents` (atomic write).
///
/// Editing is limited to **existing `.md` files** inside `topics_dir` —
/// creating new files, renaming, or touching code/quiz/state files is out
/// of scope. The write goes to a sibling temp file first, then `rename`s
/// into place so watchers (and concurrent readers) never observe a torn
/// write. Note that `rename` replaces an existing target on both POSIX and
/// Windows (std uses `MOVEFILE_REPLACE_EXISTING` there).
pub(super) fn write_file_content(
    api_path: &str,
    contents: &str,
    topics_dir: &Path,
) -> Result<WriteOutcome, std::io::Error> {
    // Reuse the reader's path parsing: `..` is rejected outright, and paths
    // outside `/topics/...` map to NotFound.
    let rest = match parse_api_path(api_path) {
        Ok(Some(rest)) => rest,
        Ok(None) => return Ok(WriteOutcome::NotFound),
        Err(()) => return Ok(WriteOutcome::Forbidden),
    };
    // Markdown-only: the GUI note editor edits notes — code, quizzes and
    // state files are deliberately not writable from the frontend.
    if Path::new(&rest).extension().map(|e| e != "md").unwrap_or(true) {
        return Ok(WriteOutcome::Forbidden);
    }
    let Some(base_canon) = topics_dir.canonicalize().ok() else {
        return Ok(WriteOutcome::NotFound);
    };
    let candidate_raw = topics_dir.join(&rest);
    // Canonicalize resolves symlinks; an escape outside `topics_dir` is
    // forbidden, exactly like the read path. A missing target maps to
    // NotFound — this command never creates files.
    let Some(target_canon) = candidate_raw.canonicalize().ok() else {
        return Ok(WriteOutcome::NotFound);
    };
    if !target_canon.starts_with(&base_canon) {
        return Ok(WriteOutcome::Forbidden);
    }

    // Atomic write: the temp file lives in the same directory (same
    // filesystem → the rename is atomic) and carries the pid so concurrent
    // writers from this process never clobber each other's temp file.
    let file_name = target_canon
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let tmp = target_canon
        .parent()
        .unwrap_or(topics_dir)
        .join(format!(".{file_name}.{}.tmp", std::process::id()));
    if let Err(e) = std::fs::write(&tmp, contents) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    match std::fs::rename(&tmp, &target_canon) {
        Ok(()) => Ok(WriteOutcome::Written),
        Err(e) => {
            let _ = std::fs::remove_file(&tmp); // don't leave litter behind
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn parse_strips_topics_prefix() {
        assert_eq!(parse_api_path("/topics/js/sessions/a.md"), Ok(Some("js/sessions/a.md".into())));
        assert_eq!(parse_api_path("/topics/js"), Ok(Some("js".into())));
        assert_eq!(parse_api_path("/topics/"), Ok(None));
        assert_eq!(parse_api_path("/not-topics/x"), Ok(None));
    }

    #[test]
    fn parse_rejects_dotdot_as_forbidden() {
        // `..` → Err(()) → 403, matching serve.mjs's `relativePart.includes('..')` → 403.
        assert_eq!(parse_api_path("/topics/../etc/passwd"), Err(()));
    }

    #[test]
    fn read_dotdot_returns_forbidden_not_404() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js").join("sessions");
        fs::create_dir_all(&topic).unwrap();
        fs::write(topic.join("notes.md"), "hello").unwrap();
        assert_eq!(
            read_file_content("/topics/../etc/passwd", root.path()),
            Err(())
        );
    }

    #[test]
    fn read_returns_none_for_missing() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js").join("sessions");
        fs::create_dir_all(&topic).unwrap();
        fs::write(topic.join("notes.md"), "hello").unwrap();
        assert_eq!(read_file_content("/topics/js/sessions/missing.md", root.path()), Ok(None));
        assert_eq!(read_file_content("/not-topics/whatever", root.path()), Ok(None));
    }

    #[test]
    fn read_returns_content_on_hit() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js").join("sessions");
        fs::create_dir_all(&topic).unwrap();
        fs::write(topic.join("notes.md"), "hello world").unwrap();
        let v = read_file_content("/topics/js/sessions/notes.md", root.path()).unwrap();
        assert_eq!(v.as_deref(), Some("hello world"));
    }

    #[test]
    fn read_symlink_escape_is_forbidden() {
        // A symlink pointing outside topics_dir must be caught by canonicalize.
        let root = tempdir().unwrap();
        let outside = tempdir().unwrap();
        fs::write(outside.path().join("secret.md"), "shh").unwrap();
        let topic = root.path().join("js").join("sessions");
        fs::create_dir_all(&topic).unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(outside.path().join("secret.md"), topic.join("escape.md"))
                .unwrap();
            assert_eq!(read_file_content("/topics/js/sessions/escape.md", root.path()), Err(()));
        }
    }

    // Smoke-check that an obviously-missing dir doesn't panic.
    #[test]
    fn read_missing_dir_returns_none() {
        assert_eq!(
            read_file_content("/topics/x.md", std::path::Path::new("/no/such/dir")),
            Ok(None)
        );
    }

    // ------------------------------------------------------------------
    //  write_file_content
    // ------------------------------------------------------------------

    fn write_fixture() -> (tempfile::TempDir, std::path::PathBuf) {
        let root = tempdir().unwrap();
        let topic = root.path().join("js").join("sessions");
        fs::create_dir_all(&topic).unwrap();
        fs::write(topic.join("notes.md"), "old").unwrap();
        (root, topic)
    }

    #[test]
    fn write_round_trips_through_read() {
        let (root, topic) = write_fixture();
        assert_eq!(
            write_file_content("/topics/js/sessions/notes.md", "new body", root.path()).unwrap(),
                WriteOutcome::Written
            );
        assert_eq!(
            read_file_content("/topics/js/sessions/notes.md", root.path()),
            Ok(Some("new body".into()))
        );
        assert_eq!(fs::read_to_string(topic.join("notes.md")).unwrap(), "new body");
    }

    #[test]
    fn write_empty_contents_round_trips() {
        let (root, _) = write_fixture();
        assert_eq!(
            write_file_content("/topics/js/sessions/notes.md", "", root.path()).unwrap(),
                WriteOutcome::Written
            );
        assert_eq!(
            read_file_content("/topics/js/sessions/notes.md", root.path()),
            Ok(Some("".into()))
        );
    }

    #[test]
    fn write_leaves_no_temp_file_behind() {
        let (root, topic) = write_fixture();
        write_file_content("/topics/js/sessions/notes.md", "x", root.path()).unwrap();
        let names: Vec<String> = fs::read_dir(&topic)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["notes.md".to_string()]);
    }

    #[test]
    fn write_missing_target_is_not_found() {
        // Creation is not supported — a non-existent file maps to NotFound.
        let (root, _) = write_fixture();
        assert_eq!(
            write_file_content("/topics/js/sessions/missing.md", "x", root.path()).unwrap(),
                WriteOutcome::NotFound
            );
        assert!(!root.path().join("js").join("sessions").join("missing.md").exists());
    }

    #[test]
    fn write_missing_topics_dir_is_not_found() {
        assert_eq!(
            write_file_content(
                "/topics/x.md",
                "x",
                std::path::Path::new("/no/such/dir")
            ).unwrap(),
                WriteOutcome::NotFound
            );
    }

    #[test]
    fn write_rejects_dotdot_as_forbidden() {
        let (root, _) = write_fixture();
        assert_eq!(
            write_file_content("/topics/../../etc/passwd", "x", root.path()).unwrap(),
                WriteOutcome::Forbidden
            );
    }

    #[test]
    fn write_rejects_non_markdown_extensions() {
        let (root, topic) = write_fixture();
        fs::write(topic.join("code.rs"), "fn main() {}").unwrap();
        fs::write(topic.join("deck.json"), "{}").unwrap();
        // Code, state and extension-less files are not writable.
        assert_eq!(
            write_file_content("/topics/js/sessions/code.rs", "x", root.path()).unwrap(),
                WriteOutcome::Forbidden
            );
        assert_eq!(
            write_file_content("/topics/js/sessions/deck.json", "x", root.path()).unwrap(),
                WriteOutcome::Forbidden
            );
        fs::write(topic.join("noext"), "data").unwrap();
        assert_eq!(
            write_file_content("/topics/js/sessions/noext", "x", root.path()).unwrap(),
                WriteOutcome::Forbidden
            );
    }

    #[test]
    fn write_symlink_escape_is_forbidden() {
        let (root, topic) = write_fixture();
        let outside = tempdir().unwrap();
        fs::write(outside.path().join("secret.md"), "shh").unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(
                outside.path().join("secret.md"),
                topic.join("escape.md"),
            )
            .unwrap();
            assert_eq!(
                write_file_content("/topics/js/sessions/escape.md", "pwn", root.path()).unwrap(),
                    WriteOutcome::Forbidden
                );
            // The symlink target must be untouched.
            assert_eq!(fs::read_to_string(outside.path().join("secret.md")).unwrap(), "shh");
        }
    }
}