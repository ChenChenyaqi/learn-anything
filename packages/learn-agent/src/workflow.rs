//! learn-topic workflow: generate a knowledge map for a new topic.
//!
//! Uses the [`ModelClient`](crate::model::ModelClient) abstraction to:
//! 1. Extract a [`StateV1`] knowledge map via structured output.
//! 2. Normalize and validate the result.
//! 3. Optionally stream progress to the UI.
//! 4. Write `state.json` and `knowledge-map.md`.

use crate::model::ModelClient;
use crate::render::render;
use crate::state::{validate_state, ConceptStatus, StateV1};
use chrono::Local;
use std::io::Write;
use std::path::Path;
use tempfile::NamedTempFile;

/* ------------------------------------------------------------------ */
/*  Prompts                                                           */
/* ------------------------------------------------------------------ */

/// Verbatim copy of the INSTRUCTIONS from
/// `packages/cli/src/core/templates/workflows/learn-topic.ts` (with
/// `HIDDEN_DIR_WARNING` expanded).  Loaded from `prompts/learn-topic.md` at
/// compile time via [`include_str!`].
const SYSTEM_PROMPT: &str = include_str!("../prompts/learn-topic.md");

/* ------------------------------------------------------------------ */
/*  Core workflow                                                     */
/* ------------------------------------------------------------------ */

/// Generate a [`StateV1`] knowledge map for `topic`.
///
/// Runs structured extraction via [`ModelClient::extract`], normalizes the
/// result (version, created date, concept stats), and validates with
/// [`validate_state`]. If validation fails, retries once with a correction
/// prompt. If it still fails, returns an error.
pub async fn learn_topic<C: ModelClient>(client: &C, topic: &str) -> anyhow::Result<StateV1> {
    let user_prompt = format!("Generate a knowledge map for: {topic}");
    let created = today();

    // First attempt
    let state = client
        .extract::<StateV1>(SYSTEM_PROMPT, &user_prompt)
        .await?;
    let state = finalize(state, topic, &created);
    let errors = validation_errors(&state);
    if errors.is_empty() {
        return Ok(state);
    }

    // Retry once with error context
    let retry_prompt = format!(
        "{user_prompt}\n\n\
         Your previous response had these validation errors:\n{}\n\n\
         Please fix them and regenerate.",
        summarize(&errors)
    );
    let state = client
        .extract::<StateV1>(SYSTEM_PROMPT, &retry_prompt)
        .await?;
    let state = finalize(state, topic, &created);
    let errors = validation_errors(&state);
    if errors.is_empty() {
        return Ok(state);
    }

    anyhow::bail!(
        "Generated knowledge map for '{topic}' failed validation after retry:\n{}",
        summarize(&errors)
    );
}

/* ------------------------------------------------------------------ */
/*  File I/O                                                          */
/* ------------------------------------------------------------------ */

/// Write `state.json` and `knowledge-map.md` into `dir`.
///
/// `dir` should be the topic directory (e.g. `.learn/topics/javascript/`).
/// The directory and its parents are created if they do not exist.
///
/// Atomic with respect to the two files: both are written or neither is.
/// Each file is staged to a uniquely-named temp file in `dir` then renamed,
/// so (a) the rename stays on one filesystem (no cross-FS `EXDEV`), (b)
/// concurrent `write_state` calls on the same directory cannot clobber each
/// other's staging files, and (c) a temp file is never left orphaned if the
/// call is dropped or panics between staging and rename. If the second
/// rename fails the already-promoted `state.json` is removed, so a caller
/// observing a failure never sees a half-written topic directory.
pub fn write_state(dir: &Path, state: &StateV1) -> anyhow::Result<()> {
    std::fs::create_dir_all(dir)?;

    let json = serde_json::to_string_pretty(state)?;
    let markdown = render(state);

    let json_path = dir.join("state.json");
    let md_path = dir.join("knowledge-map.md");

    let json_tmp = stage(dir, format!("{json}\n"))?;
    let md_tmp = stage(dir, markdown)?;

    // Promote JSON first, then MD. Roll back the promoted JSON if MD fails so
    // the directory is never left with only one of the two files. The staging
    // files clean themselves up on drop if they are not persisted.
    json_tmp.persist(&json_path).map_err(|e| e.error)?;
    if let Err(e) = md_tmp.persist(&md_path) {
        let _ = std::fs::remove_file(&json_path);
        return Err(e.error.into());
    }
    Ok(())
}

/// Write `contents` to a new uniquely-named temp file inside `dir` and return
/// the handle (un-flushed-writes-safe: flushed before returning). Unique names
/// keep concurrent staging safe; the handle removes the temp file on drop if
/// it is never [`NamedTempFile::persist`]ed.
fn stage(dir: &Path, contents: impl AsRef<[u8]>) -> anyhow::Result<NamedTempFile> {
    let mut tmp = NamedTempFile::new_in(dir)?;
    tmp.write_all(contents.as_ref())?;
    tmp.flush()?;
    Ok(tmp)
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/// Override fields that must be deterministic for a new topic:
/// - `version` → 1
/// - `created` → `created` (injected so callers/tests are deterministic)
/// - All concept stats reset to initial/unexplored values.
fn normalize(mut state: StateV1, created: &str) -> StateV1 {
    state.version = 1;
    state.created = created.to_string();
    for domain in &mut state.domains {
        for concept in &mut domain.concepts {
            concept.status = ConceptStatus::Unexplored;
            concept.confidence = 0.0;
            concept.practice_count = 0;
            concept.explain_count = 0;
            concept.last_explained = None;
            concept.last_practiced = None;
        }
    }
    state
}

/// Normalize a freshly-extracted state *and* reconcile its identity fields
/// with the user's requested `topic`: version/date/stats are reset, and
/// `topic`/`slug` are taken from the request rather than trusted from the
/// model (the model's own `topic`/`slug` are discarded).
fn finalize(mut state: StateV1, topic: &str, created: &str) -> StateV1 {
    state = normalize(state, created);
    state.topic = topic.to_string();
    state.slug = slugify(topic);
    state
}

/// Deterministic slug: lowercased, runs of non-alphanumeric chars collapse to a
/// single `-`, then leading/trailing `-` trimmed.
///
/// Non-ASCII letters (e.g. CJK) are kept verbatim on purpose: the learning
/// prompt responds in the user's language, so a Chinese topic yields a Chinese
/// slug rather than a transliterated ASCII one.
fn slugify(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut prev_dash = false;
    for c in s.trim().to_lowercase().chars() {
        if c.is_alphanumeric() {
            out.push(c);
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

/// Render validation errors as an indented bullet list for the retry prompt
/// and the final error message.
fn summarize(errors: &[crate::utils::ValidationError]) -> String {
    errors
        .iter()
        .map(|e| format!("  - {}: {}", e.path, e.message))
        .collect::<Vec<_>>()
        .join("\n")
}

fn today() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn validation_errors(state: &StateV1) -> Vec<crate::utils::ValidationError> {
    match serde_json::to_value(state) {
        Ok(value) => validate_state(&value),
        Err(e) => vec![crate::utils::ValidationError {
            path: String::new(),
            message: format!("Failed to serialize state: {e}"),
        }],
    }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;
    use crate::FakeModelClient;

    // ── 4.5: Valid extraction → writes both files ──────────────────

    #[tokio::test]
    async fn valid_extraction_writes_files() {
        let json = include_str!("../mock/state.json");
        let fake = FakeModelClient::new(vec!["Thinking...".into()], json);

        let state = learn_topic(&fake, "Rust").await.unwrap();
        let tmp = tempfile::tempdir().unwrap();
        write_state(tmp.path(), &state).unwrap();

        // state.json exists and is valid JSON with version 1
        let state_text = std::fs::read_to_string(tmp.path().join("state.json")).unwrap();
        let state_val: serde_json::Value = serde_json::from_str(&state_text).unwrap();
        assert_eq!(state_val["version"], 1);

        // knowledge-map.md exists and contains the topic title
        let map = std::fs::read_to_string(tmp.path().join("knowledge-map.md")).unwrap();
        assert!(map.starts_with("# "));
    }

    // ── 4.5: Invalid extraction (after retry) errors, writes nothing ─

    #[tokio::test]
    async fn invalid_extraction_errors_and_writes_nothing() {
        // Empty domain name — normalization can't fix this
        let bad = serde_json::json!({
            "version": 1,
            "topic": "Bad",
            "slug": "bad",
            "created": "2026-01-01",
            "domains": [{
                "name": "",
                "slug": "bad-domain",
                "concepts": [{
                    "name": "ok",
                    "slug": "ok",
                    "status": "unexplored",
                    "confidence": 0,
                    "practice_count": 0,
                    "explain_count": 0,
                    "last_explained": null,
                    "last_practiced": null,
                    "details": []
                }]
            }]
        })
        .to_string();

        let fake = FakeModelClient::new(vec![], bad);
        let result = learn_topic(&fake, "Bad").await;
        assert!(result.is_err(), "should fail after retry");
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("failed validation"),
            "error should mention validation"
        );
    }

    // ── normalize resets concept stats ─────────────────────────────

    #[test]
    fn normalize_resets_concept_stats() {
        let json = include_str!("../mock/state.json");
        let mut state: StateV1 = serde_json::from_str(json).unwrap();

        // Fixture has mastered/in-progress concepts — normalize should reset.
        state = normalize(state, "2026-01-01");
        for d in &state.domains {
            for c in &d.concepts {
                assert_eq!(c.status, ConceptStatus::Unexplored);
                assert_eq!(c.confidence, 0.0);
                assert_eq!(c.practice_count, 0);
                assert_eq!(c.explain_count, 0);
                assert!(c.last_explained.is_none());
                assert!(c.last_practiced.is_none());
            }
        }
        assert_eq!(state.version, 1);
        assert_eq!(state.created, "2026-01-01");
    }

    // ── slugify ────────────────────────────────────────────────────

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify("Rust"), "rust");
        assert_eq!(slugify("  Machine Learning  "), "machine-learning");
        assert_eq!(slugify("C++ / Rust!"), "c-rust");
        assert_eq!(slugify("---noise---"), "noise");
        assert_eq!(slugify(""), "");
    }

    #[test]
    fn slugify_keeps_cjk() {
        assert_eq!(slugify("机器学习"), "机器学习");
        assert_eq!(slugify("机器 学习"), "机器-学习");
        assert_eq!(slugify("Rust 并发"), "rust-并发");
    }

    // ── topic/slug are taken from the request, not the model ───────

    #[tokio::test]
    async fn topic_is_overridden_from_request() {
        // Model returns a mismatched topic/slug; the request must win.
        let json = include_str!("../mock/state.json");
        let fake = FakeModelClient::new(vec![], json);
        let state = learn_topic(&fake, "TypeScript").await.unwrap();
        assert_eq!(state.topic, "TypeScript");
        assert_eq!(state.slug, "typescript");
    }

    // ── write_state creates nested directories ─────────────────────

    #[test]
    fn write_state_creates_nested_dirs() {
        let json = include_str!("../mock/state.json");
        let state: StateV1 = serde_json::from_str(json).unwrap();
        let state = normalize(state, "2026-01-01");

        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("a").join("b").join("c");
        write_state(&dir, &state).unwrap();
        assert!(dir.join("state.json").exists());
        assert!(dir.join("knowledge-map.md").exists());
    }

    // ── normalized mock fixture passes validation ───────────────────

    #[tokio::test]
    async fn normalized_fixture_is_valid() {
        let json = include_str!("../mock/state.json");
        let fake = FakeModelClient::new(vec![], json);
        let state = learn_topic(&fake, "Rust").await.unwrap();
        assert_eq!(state.version, 1);
        assert!(!state.domains.is_empty());
    }
}
