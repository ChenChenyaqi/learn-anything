//! Working-folder selection, validation, and creation.
//!
//! The working folder is the project root that contains a `.learn/topics/`
//! tree (created by the CLI's `init` or by [`create_project`]). Each topic
//! lives at `.learn/topics/<slug>/` and owns a `state.json` whose
//! `"version": 1` marks it as a GUI-readable v1 topic.
//!
//! `state.yaml` (the legacy v0 format) is deliberately ignored here — it is
//! the CLI's responsibility to migrate it, not the GUI's, so a folder that
//! only has `state.yaml` files is treated the same as a brand-new folder.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;

use crate::config::{load_config, save_config};

/// Message shown when a `state.json` exists but its version is not 1. The GUI
/// does no migration (decision D7); the user must run the CLI to upgrade.
const UPGRADE_HINT: &str =
    "This folder contains a state.json the GUI cannot read (version is not 1). \
     Run `learn-anything init` in the CLI to upgrade.";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/// Lightweight summary of one existing v1 topic inside a working folder.
///
/// Only the fields the shell needs to render a topic list; the full
/// `StateV1` is not loaded here (keeps `open_project` cheap and decoupled
/// from `learn-agent`).
#[derive(Debug, Clone, Serialize)]
pub struct TopicSummary {
    pub slug: String,
    pub topic: String,
}

/// Result of opening (validating) a working folder.
///
/// `fresh` is `true` when no readable v1 topics were found (either the
/// folder has no `.learn/topics/` at all, or every entry was skipped). The
/// frontend uses this to decide whether to offer `create_project`.
#[derive(Debug, Clone, Serialize)]
pub struct ProjectInfo {
    /// The working folder that was opened (absolute, as given).
    pub dir: String,
    /// `true` when `topics` is empty.
    pub fresh: bool,
    pub topics: Vec<TopicSummary>,
}

/* ------------------------------------------------------------------ */
/*  Engine                                                            */
/* ------------------------------------------------------------------ */

/// Validate `dir` as a GUI-readable working folder.
///
/// Scans `<dir>/.learn/topics/*`:
/// - A subdirectory with a `state.json` whose `version != 1` is rejected
///   (see [`UPGRADE_HINT`]). `version == 1` contributes a [`TopicSummary`].
/// - A subdirectory with only `state.yaml` (v0), nothing, or an
///   unreadable/malformed `state.json` is skipped (one bad file must not
///   block the rest of the folder).
/// - A missing or empty `.learn/topics/` yields a `fresh` result.
fn open_project_engine(dir: &Path) -> anyhow::Result<ProjectInfo> {
    let topics_dir = dir.join(".learn").join("topics");
    let mut topics = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&topics_dir) {
        for entry in entries.flatten() {
            let subdir = entry.path();
            if !subdir.is_dir() {
                continue;
            }

            let state_json = subdir.join("state.json");
            if !state_json.exists() {
                // state.yaml-only (v0) or empty dir → ignore, treat as new.
                continue;
            }

            // Unreadable or malformed state.json → skip this one topic rather
            // than poisoning the whole folder (one corrupt file must not block
            // access to the other valid topics).
            let value: serde_json::Value = match std::fs::File::open(&state_json) {
                Ok(f) => match serde_json::from_reader(f) {
                    Ok(v) => v,
                    Err(_) => continue,
                },
                Err(_) => continue,
            };

            if value.get("version").and_then(|v| v.as_u64()) != Some(1) {
                anyhow::bail!("{UPGRADE_HINT}");
            }

            let topic = value
                .get("topic")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let slug = value
                .get("slug")
                .and_then(|v| v.as_str())
                .map(String::from)
                .unwrap_or_else(|| {
                    subdir
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("topic")
                        .to_string()
                });

            topics.push(TopicSummary { slug, topic });
        }
    }

    // Stable ordering so the frontend topic list doesn't shuffle between launches.
    topics.sort_by(|a, b| a.slug.cmp(&b.slug));
    let fresh = topics.is_empty();
    Ok(ProjectInfo {
        dir: dir.to_string_lossy().into_owned(),
        fresh,
        topics,
    })
}

/// Ensure `<dir>/.learn/topics/` exists, creating it (and any missing
/// parents) if necessary. Returns the topics directory path.
fn create_project_engine(dir: &Path) -> anyhow::Result<PathBuf> {
    let topics = dir.join(".learn").join("topics");
    std::fs::create_dir_all(&topics)?;
    Ok(topics)
}

/* ------------------------------------------------------------------ */
/*  Tauri commands                                                    */
/* ------------------------------------------------------------------ */

/// Open a native folder-picker and persist the choice to appData
/// (`last_working_folder`) immediately on selection. Returns `Some(path)`
/// on pick, `None` when the user cancels.
///
/// Deliberately does NOT validate: persistence is cheap and lets the UI
/// re-open the last folder on next launch even before [`open_project`] runs.
/// Validation is a separate follow-up step ([`open_project`] to validate /
/// [`create_project`] to scaffold a new folder).
#[tauri::command]
pub async fn pick_project_dir(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = oneshot::channel();
    app.dialog().file().pick_folder(move |picked| {
        let _ = tx.send(picked);
    });
    let picked = rx
        .await
        .map_err(|_| "Folder picker was dropped before responding.".to_string())?;

    let path = match picked {
        Some(fp) => fp.into_path().map_err(|e| e.to_string())?,
        None => return Ok(None),
    };
    let picked = path.to_string_lossy().into_owned();

    let mut config = load_config(&app).map_err(|e| e.to_string())?;
    config.last_working_folder = Some(picked.clone());
    save_config(&app, &config).map_err(|e| e.to_string())?;

    Ok(Some(picked))
}

/// Validate a working folder and list its readable v1 topics.
///
/// Returns [`ProjectInfo`] on success. Errors carry the [`UPGRADE_HINT`]
/// message when a `state.json` with an unsupported version is found.
#[tauri::command]
pub fn open_project(dir: String) -> Result<ProjectInfo, String> {
    open_project_engine(Path::new(&dir)).map_err(|e| e.to_string())
}

/// Create the `.learn/topics/` skeleton inside `dir` for a new working
/// folder. Idempotent: safe to call on a folder that already has the tree.
/// Returns the absolute path to the created topics directory.
#[tauri::command]
pub fn create_project(dir: String) -> Result<String, String> {
    create_project_engine(Path::new(&dir))
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    /// Write a `state.json` into `topic_dir`.
    fn write_state(topic_dir: &Path, json: &str) {
        fs::write(topic_dir.join("state.json"), json).unwrap();
    }

    fn topics_dir(root: &Path) -> PathBuf {
        root.join(".learn").join("topics")
    }

    // ── open_project_engine ─────────────────────────────────────────

    #[test]
    fn open_accepts_all_v1_topics() {
        let root = tempdir().unwrap();
        let topics = topics_dir(root.path());
        fs::create_dir_all(topics.join("rust")).unwrap();
        fs::create_dir_all(topics.join("go")).unwrap();
        write_state(
            &topics.join("rust"),
            r#"{"version":1,"topic":"Rust","slug":"rust"}"#,
        );
        write_state(
            &topics.join("go"),
            r#"{"version":1,"topic":"Go","slug":"go"}"#,
        );

        let info = open_project_engine(root.path()).unwrap();
        assert!(!info.fresh);
        assert_eq!(info.topics.len(), 2);
        let by_slug: std::collections::HashMap<&str, &str> = info
            .topics
            .iter()
            .map(|t| (t.slug.as_str(), t.topic.as_str()))
            .collect();
        assert_eq!(by_slug.get("rust"), Some(&"Rust"));
        assert_eq!(by_slug.get("go"), Some(&"Go"));
    }

    #[test]
    fn open_rejects_unsupported_version() {
        let root = tempdir().unwrap();
        let topics = topics_dir(root.path());
        fs::create_dir_all(topics.join("future")).unwrap();
        write_state(
            &topics.join("future"),
            r#"{"version":2,"topic":"Future","slug":"future"}"#,
        );

        let err = open_project_engine(root.path()).unwrap_err();
        assert!(err.to_string().contains("learn-anything init"));
    }

    #[test]
    fn open_ignores_v0_state_yaml() {
        let root = tempdir().unwrap();
        let topics = topics_dir(root.path());
        let legacy = topics.join("legacy");
        fs::create_dir_all(&legacy).unwrap();
        // v0 marker: state.yaml, no state.json.
        fs::write(legacy.join("state.yaml"), "topic: Legacy\n").unwrap();

        let info = open_project_engine(root.path()).unwrap();
        assert!(info.fresh, "a v0-only folder should be treated as fresh");
        assert!(info.topics.is_empty());
    }

    #[test]
    fn open_missing_learn_is_fresh() {
        let root = tempdir().unwrap();
        let info = open_project_engine(root.path()).unwrap();
        assert!(info.fresh);
        assert!(info.topics.is_empty());
    }

    #[test]
    fn open_mixed_v1_and_v0_keeps_v1() {
        let root = tempdir().unwrap();
        let topics = topics_dir(root.path());
        // A readable v1 topic.
        fs::create_dir_all(topics.join("rust")).unwrap();
        write_state(
            &topics.join("rust"),
            r#"{"version":1,"topic":"Rust","slug":"rust"}"#,
        );
        // A v0 topic that must be ignored, not rejected.
        let legacy = topics.join("legacy");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("state.yaml"), "topic: Legacy\n").unwrap();

        let info = open_project_engine(root.path()).unwrap();
        assert!(!info.fresh);
        assert_eq!(info.topics.len(), 1);
        assert_eq!(info.topics[0].slug, "rust");
    }

    #[test]
    fn open_skips_corrupt_state_json() {
        let root = tempdir().unwrap();
        let topics = topics_dir(root.path());
        // One corrupt topic: state.json exists but is not valid JSON.
        let bad = topics.join("bad");
        fs::create_dir_all(&bad).unwrap();
        fs::write(bad.join("state.json"), b"{ not valid json").unwrap();
        // One readable v1 topic alongside it.
        fs::create_dir_all(topics.join("rust")).unwrap();
        write_state(
            &topics.join("rust"),
            r#"{"version":1,"topic":"Rust","slug":"rust"}"#,
        );

        let info = open_project_engine(root.path()).unwrap();
        assert!(!info.fresh, "the valid topic must still be readable");
        assert_eq!(info.topics.len(), 1);
        assert_eq!(info.topics[0].slug, "rust");
    }

    // ── create_project_engine ───────────────────────────────────────

    #[test]
    fn create_builds_topics_tree() {
        let root = tempdir().unwrap();
        let topics = create_project_engine(root.path()).unwrap();
        assert!(topics.ends_with(".learn/topics"));
        assert!(topics.is_dir());
    }

    #[test]
    fn create_is_idempotent() {
        let root = tempdir().unwrap();
        create_project_engine(root.path()).unwrap();
        // Second call must not error.
        create_project_engine(root.path()).unwrap();
        assert!(topics_dir(root.path()).is_dir());
    }
}
