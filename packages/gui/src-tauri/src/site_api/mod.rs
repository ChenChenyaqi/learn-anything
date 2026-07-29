//! Web dashboard backend ported from `packages/cli/site/serve.mjs` into the
//! Tauri Rust backend.
//!
//! Replaces the Node HTTP server with **Tauri commands + a `site://reload`
//! event** (no HTTP port). The web-frontend surface stays the same:
//!   - `site_topic_summaries`      → JS `GET /api/topics`
//!   - `site_topic_data`           → JS `GET /api/topics/:slug`
//!   - `site_file_content`         → JS `GET /api/file?path=`
//!   - `site_quiz_deck`            → JS `GET /api/quizzes/:topic/:rest`
//!   - `site_search_index`         → JS `GET /api/search-index`
//!   - event `site://reload`       → JS SSE (`/api/events`) reload broadcasts
//!
//! Topics live at `<working_folder>/.learn/topics/`. Settings remembered in
//! `AppConfig.last_working_folder`; passing `working_folder` explicitly (or
//! changing it via `set_config`) overrides the persisted default. The CLI's
//! `state.json` v1 schema is not enforced here — the GUI shell's
//! `project.rs::open_project` keeps its own strict version check separate.
//!
//! Error convention: Tauri commands return `Err(String)` of the form
//! `"<code>|<message>"` — `403`, `404`, `500`. The desktop UI strips the
//! prefix to recover the HTTP-like semantics of the original API.

mod content;
mod model;
mod quizzes;
mod search;
mod topics;
mod watcher;

use std::path::PathBuf;

use serde_json::Value;
use tauri::AppHandle;

use crate::config::load_config;

use topics::build_topic_summaries;

/// Prefix errors with their HTTP-like code. Kept tiny and explicit so the
/// frontend can `split('|', 1)` and branch.
fn err(code: u16, msg: impl Into<String>) -> String {
    format!("{code}|{}", msg.into())
}

/// Resolve the `<working_folder>/.learn/topics` directory.
///
/// `working_folder` overrides `AppConfig.last_working_folder` when present.
/// A missing `last_working_folder` returns `Ok(None)` (the frontend will show
/// the dashboard's "no folder picked" empty state); the commands map `None`
/// to `404`-style empty results rather than erroring so the UI still renders.
fn resolve_topics_dir(app: &AppHandle, working_folder: Option<String>) -> Result<Option<PathBuf>, String> {
    let folder = match working_folder.or_else(|| {
        load_config(app)
            .ok()
            .and_then(|c| c.last_working_folder)
            .filter(|s| !s.trim().is_empty())
    }) {
        Some(p) => p,
        None => return Ok(None),
    };
    let topics = PathBuf::from(folder).join(".learn").join("topics");
    Ok(Some(topics))
}

/* ------------------------------------------------------------------ */
/*  Tauri commands                                                    */
/* ------------------------------------------------------------------ */

/// List summary rows for every readable topic in the working folder.
/// `404|No working folder` if no folder has been chosen yet.
#[tauri::command]
pub fn site_topic_summaries(
    app: AppHandle,
    working_folder: Option<String>,
) -> Result<Vec<model::TopicSummary>, String> {
    let Some(topics_dir) = resolve_topics_dir(&app, working_folder)? else {
        return Err(err(404, "No working folder"));
    };
    Ok(build_topic_summaries(&topics_dir))
}

/// Return the full payload for one topic. `404|Topic not found` when the
/// topic dir doesn't exist.
#[tauri::command]
pub fn site_topic_data(
    app: AppHandle,
    slug: String,
    working_folder: Option<String>,
) -> Result<Option<model::TopicData>, String> {
    let Some(topics_dir) = resolve_topics_dir(&app, working_folder)? else {
        return Ok(None);
    };
    Ok(topics::build_topic_data(&slug, &topics_dir))
}

/// Read a markdown file at an API path like `/topics/...`.
/// `Ok(None)` = the path was valid but the file doesn't exist (404).
/// `Err("403|Forbidden")` = path traversal attempted.
#[tauri::command]
pub fn site_file_content(
    app: AppHandle,
    path: String,
    working_folder: Option<String>,
) -> Result<Option<String>, String> {
    let Some(topics_dir) = resolve_topics_dir(&app, working_folder)? else {
        return Ok(None);
    };
    match content::read_file_content(&path, &topics_dir) {
        Ok(v) => Ok(v),
        Err(()) => Err(err(403, "Forbidden")),
    }
}

/// Fetch a single quiz deck JSON. `Err("403|Forbidden")` for traversal,
/// `Ok(None)` for "not found"/"unreadable", `Ok(Some(value))` on hit.
#[tauri::command]
pub fn site_quiz_deck(
    app: AppHandle,
    topic: String,
    rest: String,
    working_folder: Option<String>,
) -> Result<Option<Value>, String> {
    let Some(topics_dir) = resolve_topics_dir(&app, working_folder)? else {
        return Ok(None);
    };
    match quizzes::read_quiz_deck(&topic, &rest, &topics_dir) {
        Ok(v) => Ok(v),
        Err(()) => Err(err(403, "Forbidden")),
    }
}

/// Return the cached flat search index for the working folder.
#[tauri::command]
pub fn site_search_index(
    app: AppHandle,
    working_folder: Option<String>,
) -> Result<Vec<model::SearchEntry>, String> {
    let Some(topics_dir) = resolve_topics_dir(&app, working_folder)? else {
        return Ok(Vec::new());
    };
    Ok(search::get_or_build(&topics_dir))
}

/* ------------------------------------------------------------------ */
/*  Watcher                                                           */
/* ------------------------------------------------------------------ */

/// Boot the filesystem watcher that emits `site://reload` whenever
/// `<last_working_folder>/.learn/topics` changes. The frontend listens and
/// re-fetches. If no folder has been chosen yet, the watcher is deferred
/// (the desktop app will (re)start it via `site_set_watcher_folder`).
pub fn boot_watcher(app: AppHandle) {
    if let Ok(Some(folder)) = load_config(&app).map(|c| c.last_working_folder) {
        let dir = PathBuf::from(folder).join(".learn").join("topics");
        let _ = watcher::start(&app, dir);
    }
}

/// (Re)start the watcher pointed at a new working folder. Returns nothing —
/// the frontend just calls it whenever a project is opened and lets the
/// watcher take over.
#[tauri::command]
pub fn site_set_watcher_folder(
    app: AppHandle,
    working_folder: String,
) -> Result<(), String> {
    let dir = PathBuf::from(working_folder).join(".learn").join("topics");
    watcher::start(&app, dir).map_err(|e| err(500, e))
}