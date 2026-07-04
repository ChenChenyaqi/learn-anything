//! The [`Workspace`] scope and its canonicalize-based path guards.
//!
//! A [`Workspace`] holds the original working-folder path plus a lazily-cached
//! canonical root (shared across clones via `Arc<OnceLock>`). All tool paths
//! are resolved relative to the root and canonicalized before the operation to
//! enforce the prefix rule: a resolved path that does not start with the
//! canonical root is rejected as a [`ToolError::PathEscapes`].

use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use super::ToolError;

/// A working-folder scope. Clones share the cached canonical root, so clones
/// are cheap and re-canonicalization happens at most once per workspace.
#[derive(Debug, Clone)]
pub struct Workspace {
    working_folder: PathBuf,
    canonical_root: Arc<OnceLock<PathBuf>>,
}

impl Workspace {
    /// Create a new workspace scope. Does NOT canonicalize eagerly — the
    /// canonical root is derived lazily on the first [`Self::resolve_within`]
    /// call so construction never blocks on the filesystem.
    pub fn new(working_folder: impl Into<PathBuf>) -> Self {
        Self {
            working_folder: working_folder.into(),
            canonical_root: Arc::new(OnceLock::new()),
        }
    }

    /// The unresolved working folder path the workspace was constructed with.
    pub fn as_path(&self) -> &Path {
        &self.working_folder
    }

    /// Resolve and cache the canonical root once. For the lifetime of a
    /// session the working folder is treated as immutable, so a cached root is
    /// reused. Tools use this as a walk base to avoid the `/var` →
    /// `/private/var` symlink mismatch between [`Self::as_path`] and the
    /// canonical root on macOS.
    pub fn canonical_root(&self) -> Result<PathBuf, ToolError> {
        if let Some(root) = self.canonical_root.get() {
            return Ok(root.clone());
        }
        let root = std::fs::canonicalize(&self.working_folder).map_err(|e| {
            ToolError::Canonicalize(format!("working folder {}: {e}", self.working_folder.display()))
        })?;
        let _ = self.canonical_root.set(root.clone());
        Ok(root)
    }

    /// Resolve `rel` (which may be relative or absolute) to a canonical path
    /// that MUST start with the canonicalized working folder. Refuses paths
    /// that escape the workspace.
    ///
    /// For paths that don't yet exist (e.g. a `WriteFile` target), this
    /// canonicalizes the nearest existing ancestor and appends the remaining
    /// components (see [`canonicalize_or_parent`]).
    pub fn resolve_within(&self, rel: &str) -> Result<PathBuf, ToolError> {
        let root = self.canonical_root()?;
        let rel = rel.trim();
        let candidate: PathBuf = if rel.is_empty() {
            root.clone()
        } else {
            let p = Path::new(rel);
            if p.is_absolute() {
                p.to_path_buf()
            } else {
                root.join(p)
            }
        };

        let canonical = canonicalize_or_parent(&candidate)?;
        if !canonical.starts_with(&root) {
            return Err(ToolError::PathEscapes {
                resolved: canonical.display().to_string(),
                allowed: root.display().to_string(),
            });
        }
        Ok(canonical)
    }

    /// Strip the canonical root from `abs` and return a workspace-relative
    /// string. Falls back to the absolute path if `abs` is not inside the
    /// root.
    pub(super) fn relative_to_root(&self, abs: &Path) -> String {
        if let Ok(root) = self.canonical_root() {
            if let Ok(rel) = abs.strip_prefix(&root) {
                return rel.display().to_string();
            }
        }
        abs.display().to_string()
    }
}

/// Canonicalize a path; if it doesn't exist (a not-yet-written file), walk up
/// to the first existing ancestor, canonicalize that, and re-append the
/// remaining components. Rejects any remaining component that is `..` or
/// contains a path separator (so an attacker can't smuggle a `..` into the
/// non-existent tail to escape the workspace after the parent is created).
fn canonicalize_or_parent(path: &Path) -> Result<PathBuf, ToolError> {
    if let Ok(p) = std::fs::canonicalize(path) {
        return Ok(p);
    }
    // Walk up collecting non-existent tail components until we hit something
    // that exists on disk.
    let mut tail: Vec<String> = Vec::new();
    let mut current = path.to_path_buf();
    let ancestor = loop {
        match std::fs::canonicalize(&current) {
            Ok(p) => break p,
            Err(_) => {
                let Some(name) = current.file_name() else {
                    return Err(ToolError::Canonicalize(format!(
                        "no file name to walk up from: {}",
                        path.display()
                    )));
                };
                tail.push(name.to_string_lossy().into_owned());
                let Some(parent) = current.parent() else {
                    return Err(ToolError::Canonicalize(format!(
                        "reached filesystem root while resolving: {}",
                        path.display()
                    )));
                };
                if parent.as_os_str().is_empty() {
                    return Err(ToolError::Canonicalize(format!(
                        "no existing ancestor for: {}",
                        path.display()
                    )));
                }
                current = parent.to_path_buf();
            }
        }
    };
    // Re-append the tail in original order (reverse-of-collection).
    let mut full = ancestor;
    for seg in tail.into_iter().rev() {
        if seg == ".." || seg.contains('/') || seg.contains('\\') {
            return Err(ToolError::PathEscapes {
                resolved: full.join(&seg).display().to_string(),
                allowed: full.display().to_string(),
            });
        }
        full = full.join(seg);
    }
    Ok(full)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::os::unix::fs::symlink;
    use tempfile::TempDir;

    fn ws(d: &TempDir) -> Workspace {
        Workspace::new(d.path())
    }

    #[test]
    fn resolve_within_rejects_dotdot_escape() {
        let dir = TempDir::new().unwrap();
        let ws = ws(&dir);
        let escaped = ws.resolve_within("../outside.txt").unwrap_err();
        assert!(matches!(escaped, ToolError::PathEscapes { .. }), "{escaped:?}");
    }

    #[test]
    fn resolve_within_allows_inner_path() {
        let dir = TempDir::new().unwrap();
        let ws = ws(&dir);
        let inner = ws.resolve_within("src/main.rs").unwrap();
        // Compare against the canonical root (handles /var -> /private/var).
        let root = ws.canonical_root().unwrap();
        assert!(inner.starts_with(&root), "inner={} root={}", inner.display(), root.display());
        assert!(inner.ends_with("src/main.rs"));
    }

    #[test]
    fn resolve_within_rejects_symlink_outside() {
        let dir = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        fs::write(outside.path().join("secret.txt"), b"pwned").unwrap();
        symlink(outside.path(), dir.path().join("escape")).unwrap();
        let ws = ws(&dir);
        let err = ws.resolve_within("escape/secret.txt").unwrap_err();
        assert!(matches!(err, ToolError::PathEscapes { .. }), "{err:?}");
    }

    #[test]
    fn resolve_within_allows_symlink_inside() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("real.txt"), b"ok").unwrap();
        symlink("real.txt", dir.path().join("link.txt")).unwrap();
        let ws = ws(&dir);
        let resolved = ws.resolve_within("link.txt").unwrap();
        // `canonicalize` follows the symlink to its target's canonical form,
        // so resolution lands on `real.txt`, not `link.txt`.
        assert!(resolved.ends_with("real.txt"), "resolved={}", resolved.display());
    }
}