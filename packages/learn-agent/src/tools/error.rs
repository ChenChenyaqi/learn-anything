//! The [`ToolError`] enum shared by every tool.
//!
//! Implements `std::error::Error` (rig's `Tool::Error` requires it) and
//! produces model-actionable `Display` strings: every variant names the
//! failure reason and, where relevant, the resolved-vs-allowed path so the
//! model can course-correct in a later turn.

use thiserror::Error;

/// Errors any tool can return.
#[derive(Debug, Error)]
pub enum ToolError {
    #[error("path escapes the workspace: resolved {resolved} is outside {allowed}")]
    PathEscapes { resolved: String, allowed: String },
    #[error("path could not be canonicalized: {0}")]
    Canonicalize(String),
    #[error("file not found: {0}")]
    NotFound(String),
    #[error("target is a directory, not a file: {0}")]
    TargetIsDir(String),
    #[error("target is a file, not a directory: {0}")]
    TargetIsFile(String),
    #[error("no occurrence of the search string in {path}")]
    EditNotFound { path: String },
    #[error("multiple occurrences ({count}) without replace_all=true: {path}")]
    EditMultiple { path: String, count: usize },
    #[error("`old` and `new` are identical — refusing no-op edit")]
    EditNoop,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("command not found: {0}")]
    CommandNotFound(String),
    #[error("command timed out after 120s: {0}")]
    CommandTimeout(String),
    #[error("command failed to spawn: {0}")]
    CommandSpawn(String),
    #[error("regex error: {0}")]
    Regex(#[from] regex::Error),
    #[error("glob pattern error: {0}")]
    GlobPattern(#[from] glob::PatternError),
    #[error("glob error: {0}")]
    Glob(#[from] glob::GlobError),
    #[error("truncated stdout exceeded internal buffer")]
    Truncated,
}