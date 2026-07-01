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
use futures::StreamExt;
use std::path::Path;

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
/*  Streaming variant                                                 */
/* ------------------------------------------------------------------ */

/// Event yielded by [`learn_topic_stream`].
#[derive(Debug, Clone)]
pub enum LearnTopicEvent {
    /// Progress text streamed from the model.
    Delta(String),
    /// Final rendered knowledge-map markdown.
    Done(String),
}

/// Streaming variant of [`learn_topic`].
///
/// First streams a brief progress description from the model (yielding
/// [`LearnTopicEvent::Delta`] for each text chunk), then runs extraction and
/// validation, and finally yields [`LearnTopicEvent::Done`] with the rendered
/// `knowledge-map.md` markdown.
///
/// If any step fails the stream yields `Err` and terminates.
pub fn learn_topic_stream<'a, C: ModelClient>(
    client: &'a C,
    topic: &'a str,
) -> impl futures::Stream<Item = anyhow::Result<LearnTopicEvent>> + Send + 'a {
    async_stream::try_stream! {
        // Phase 1: stream a brief progress message.
        let stream_msg = format!("I want to learn {topic}. Briefly describe the roadmap.");
        let mut stream = client.stream(SYSTEM_PROMPT, &stream_msg).await?;
        while let Some(delta) = stream.next().await {
            yield LearnTopicEvent::Delta(delta?);
        }

        // Phase 2: extract + validate (may retry internally).
        let state = learn_topic(client, topic).await?;

        // Phase 3: yield the rendered markdown.
        yield LearnTopicEvent::Done(render(&state));
    }
}

/* ------------------------------------------------------------------ */
/*  File I/O                                                          */
/* ------------------------------------------------------------------ */

/// Write `state.json` and `knowledge-map.md` into `dir`.
///
/// `dir` should be the topic directory (e.g. `.learn/topics/javascript/`).
/// The directory and its parents are created if they do not exist.
pub fn write_state(dir: &Path, state: &StateV1) -> anyhow::Result<()> {
    std::fs::create_dir_all(dir)?;

    let json = serde_json::to_string_pretty(state)?;
    std::fs::write(dir.join("state.json"), format!("{json}\n"))?;

    let markdown = render(state);
    std::fs::write(dir.join("knowledge-map.md"), markdown)?;

    Ok(())
}

/// Async twin of [`write_state`] for async runtimes (e.g. a Tauri command
/// running on a Tokio handle), so file I/O never blocks the executor thread.
pub async fn write_state_async(dir: &Path, state: &StateV1) -> anyhow::Result<()> {
    tokio::fs::create_dir_all(dir).await?;

    let json = serde_json::to_string_pretty(state)?;
    tokio::fs::write(dir.join("state.json"), format!("{json}\n")).await?;

    let markdown = render(state);
    tokio::fs::write(dir.join("knowledge-map.md"), markdown).await?;

    Ok(())
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

    // ── 4.4: Stream yields Deltas then Done ────────────────────────

    #[tokio::test]
    async fn stream_yields_deltas_then_done() {
        let json = include_str!("../mock/state.json");
        let fake = FakeModelClient::new(vec!["Building ".into(), "roadmap...".into()], json);

        let events: Vec<anyhow::Result<LearnTopicEvent>> =
            learn_topic_stream(&fake, "Rust").collect().await;

        // Expect: Delta("Building "), Delta("roadmap..."), Done(markdown)
        assert_eq!(events.len(), 3, "got {events:?}");

        assert!(matches!(
            &events[0],
            Ok(LearnTopicEvent::Delta(s)) if s == "Building "
        ));
        assert!(matches!(
            &events[1],
            Ok(LearnTopicEvent::Delta(s)) if s == "roadmap..."
        ));
        assert!(matches!(
            &events[2],
            Ok(LearnTopicEvent::Done(md)) if md.starts_with("# ")
        ));
    }

    // ── 4.4: Stream yields error when extraction fails ─────────────

    #[tokio::test]
    async fn stream_errors_on_invalid_extraction() {
        let bad = serde_json::json!({
            "version": 1,
            "topic": "X",
            "slug": "x",
            "created": "2026-01-01",
            "domains": [{ "name": "", "slug": "d", "concepts": [] }]
        })
        .to_string();

        let fake = FakeModelClient::new(vec!["hi".into()], bad);
        let events: Vec<anyhow::Result<LearnTopicEvent>> =
            learn_topic_stream(&fake, "X").collect().await;

        // Delta("hi") then Err(...)
        assert_eq!(events.len(), 2);
        assert!(matches!(&events[0], Ok(LearnTopicEvent::Delta(_))));
        assert!(events[1].is_err());
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

    // ── write_state_async writes the same files ────────────────────

    #[tokio::test]
    async fn write_state_async_writes_files() {
        let json = include_str!("../mock/state.json");
        let state: StateV1 = serde_json::from_str(json).unwrap();
        let state = normalize(state, "2026-01-01");

        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("x").join("y");
        write_state_async(&dir, &state).await.unwrap();

        let state_text = tokio::fs::read_to_string(dir.join("state.json"))
            .await
            .unwrap();
        let val: serde_json::Value = serde_json::from_str(&state_text).unwrap();
        assert_eq!(val["version"], 1);
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
