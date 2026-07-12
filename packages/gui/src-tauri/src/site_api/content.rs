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
}