//! Serialization models mirroring the JSON shapes produced by `serve.mjs`, so
//! the GUI frontend can reuse the existing `useTopicData.ts` contract types
//! (incl. the eventual new desktop UI). Field names are **camelCase**
//! throughout, including the quiz groups — `serve.mjs` used snake_case there
//! (`concept_slug` / `concept_name`); the user opted for a uniform camelCase
//! contract for the new UI.
//!
//! All structs derive `Serialize` (returned from Tauri commands) and most also
//! derive `Deserialize` so they can read the on-disk `state.json` via serde_json
//! without modeling every field — unknown fields are silently skipped.

use serde::{Deserialize, Serialize};

use std::collections::BTreeMap;

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
/*  topic data (GET /api/topics/:slug)                               */
/* ------------------------------------------------------------------ */

/// Full payload for one topic, returned by `site_topic_data`.
///
/// `sessions` is a flat map keyed by domain directory name → list of `.md`
/// files. `root_sessions` are top-level `.md` files not under any domain.
/// `exercises` are grouped by concept slug; `root_exercises` are top-level
/// files. Mirrors `serve.mjs::buildTopicData` 1:1.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicData {
    /// The parsed `state.json` (full schema). Omitted fields are serde defaults.
    pub state: StateV1,
    /// `knowledge-map.md` contents (`""` if absent).
    pub knowledge_map: String,
    /// Domain dir name → `.md` files under `sessions/<dir>/`.
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub sessions: BTreeMap<String, Vec<SessionFile>>,
    /// Top-level `.md` files directly under `sessions/`.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub root_sessions: Vec<SessionFile>,
    /// Exercises grouped by concept slug.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub exercises: Vec<ExerciseGroup>,
    /// Top-level exercise files directly under `exercises/`.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub root_exercises: Vec<ExerciseFile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionFile {
    pub filename: String,
    /// API-style path (`/topics/<slug>/sessions/<rel>`), kept stable for the
    /// forthcoming UI even though the Rust backend resolves it to a fs path.
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExerciseFile {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExerciseGroup {
    pub concept_slug: String,
    pub concept_name: String,
    pub files: Vec<ExerciseFile>,
}

/* ------------------------------------------------------------------ */
/*  quizzes (GET /api/quizzes?topic=, GET /api/quizzes/:t/:rest)     */
/* ------------------------------------------------------------------ */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizList {
    pub groups: Vec<QuizGroup>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizGroup {
    pub concept_slug: String,
    pub concept_name: String,
    pub files: Vec<QuizFile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuizFile {
    pub filename: String,
    pub path: String,
}

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