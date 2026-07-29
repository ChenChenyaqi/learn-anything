//! Serialization models for the desktop UI's learning-state backend.
//!
//! Field names are **camelCase** throughout (via `#[serde(rename_all =
//! "camelCase")]` on the summary/data structs). The per-topic payload mirrors
//! the post-recursive-mirror shape: a recursive physical file tree collected as
//! flat relative paths (`files: { sessions, exercises, quizzes }`), so arbitrary
//! nesting depth renders correctly. The old fixed-depth domain/concept grouping
//! was retired.
//!
//! All structs derive `Serialize` (returned from Tauri commands) and most also
//! derive `Deserialize` so they can read the on-disk `state.json` via serde_json
//! without modeling every field — unknown fields are silently skipped.

use serde::{Deserialize, Serialize};

/* ------------------------------------------------------------------ */
/*  state.json                                                        */
/* ------------------------------------------------------------------ */

/// Persisted v1 topic state, lifted verbatim from `<topic>/state.json`.
///
/// Only the fields the readers actually consult are typed; everything else on
/// disk (e.g. `created`, optional future fields) is ignored via
/// `#[serde(default)]` + untyped passthrough — to keep this resilient if the
/// CLI adds fields later.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct StateV1 {
    #[serde(default)]
    pub version: Option<u64>,
    #[serde(default)]
    pub topic: String,
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub created: String,
    #[serde(default)]
    pub domains: Vec<Domain>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Domain {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub concepts: Vec<Concept>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Concept {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub confidence: f64,
    #[serde(default)]
    pub practice_count: u64,
    #[serde(default)]
    pub explain_count: u64,
    #[serde(default)]
    pub last_explained: Option<String>,
    #[serde(default)]
    pub last_practiced: Option<String>,
    #[serde(default)]
    pub details: Vec<String>,
}

/* ------------------------------------------------------------------ */
/*  topic summaries (GET /api/topics)                                 */
/* ------------------------------------------------------------------ */

/// Lightweight per-topic row returned by `site_topic_summaries`.
///
/// Serializes to `camelCase` per the user's contract choice: `domainCount` /
/// `totalConcepts` / `masteredCount` / `percentage` / `domainNames` / `slug` /
/// `name`. `domain_names` carries the ordered domain display names so the
/// overview can render a one-line description (e.g. "Ownership, async, traits")
/// without a second per-topic fetch.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicSummary {
    pub slug: String,
    pub name: String,
    pub domain_count: u64,
    pub total_concepts: u64,
    pub mastered_count: u64,
    pub percentage: u64,
    pub domain_names: Vec<String>,
}

/* ------------------------------------------------------------------ */
/*  topic data (site_topic_data)                                       */
/* ------------------------------------------------------------------ */

/// Full payload for one topic, returned by `site_topic_data`.
///
/// `files` collects recursive flat relative paths (prefixed with the subdir
/// name, e.g. `sessions/js/es6/func.md` or
/// `exercises/js/es6/func/arrow-func/index.js`) so the frontend can build a
/// recursive file tree mirroring the actual filesystem. Mirrors the post-mirror
/// cli/site `buildTopicData` shape.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicData {
    /// The parsed `state.json` (full schema). Omitted fields are serde defaults.
    pub state: StateV1,
    /// `knowledge-map.md` contents (`""` if absent).
    pub knowledge_map: String,
    /// Recursive flat relative paths for the three file axes.
    pub files: TopicFiles,
}

/// Recursive flat relative paths under `<topic>/sessions|exercises|quizzes/`.
///
/// Each entry is prefixed with its axis (`sessions/`, `exercises/`,
/// `quizzes/`); the frontend tree builder drops the first segment. Sessions are
/// `.md` files (binary included); exercises are all non-binary files; quizzes
/// are `.json` files (binary included). Dot-dirs (`.learn`, `.git`, …) and
/// symlinks are skipped.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicFiles {
    pub sessions: Vec<String>,
    pub exercises: Vec<String>,
    pub quizzes: Vec<String>,
}

/* ------------------------------------------------------------------ */
/*  quizzes (GET /api/quizzes/:topic/:rest)                            */
/* ------------------------------------------------------------------ */

/// A single quiz deck is returned as a raw JSON `Value` by `read_quiz_deck`
/// (passed through verbatim) — no dedicated model needed.

/* ------------------------------------------------------------------ */
/*  search index (GET /api/search-index)                              */
/* ------------------------------------------------------------------ */

/// One entry in the flat search index.
///
/// A `level == 0` entry is a filename pseudo-entry (so users can search by
/// filename); `level >= 1` entries are ATX headings inside that file. The
/// `api_path` is the same path used by `site_file_content`, so a click can
/// load the file and jump to the heading.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchEntry {
    pub title: String,
    pub level: u32,
    pub path: String,
    pub topic_slug: String,
    pub topic_name: String,
    pub section: String,
    pub kind: String,
}