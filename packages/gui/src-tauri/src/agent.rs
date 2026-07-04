//! Agent workflow Tauri commands.
//!
//! These commands run full agent workflows by wiring together three concerns:
//! the keychain (API key), the appData config (provider/model/working folder),
//! and the `learn-agent` workflow functions. They emit Tauri events so the
//! frontend can react to long-running operations; the command return value
//! mirrors the success payload for callers that prefer to `await` instead of
//! `listen`.

use std::path::PathBuf;

use learn_agent::model::Provider;
use learn_agent::{learn_topic, write_state, LocalModelClient};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::config::{load_config, AppConfig};
use crate::keychain;

/// Emitted on success: the topic was generated and written to disk.
const EVENT_DONE: &str = "agent:done";
/// Emitted on failure: the topic could not be generated (no files written by
/// the workflow itself).
const EVENT_ERROR: &str = "agent:error";

/// Success payload of [`chat_create_topic`] / the `agent:done` event.
///
/// Carries only locating metadata, never the markdown/state content — the
/// frontend confirms "created" and points at the files rather than echoing
/// the knowledge map back into the chat.
#[derive(Debug, Clone, Serialize)]
pub struct TopicCreated {
    pub slug: String,
    pub topic: String,
    /// Absolute path to the topic directory holding the new `state.json` and
    /// `knowledge-map.md`.
    pub dir: String,
}

/// Generate a knowledge map for `topic` and write it under the working folder.
///
/// Prerequisites (each surfaces a clear error if missing):
/// - A stored API key (keychain).
/// - A configured model id (appData config).
/// - A chosen working folder (`last_working_folder` in appData config).
///
/// On success it writes `<working folder>/.learn/topics/<slug>/{state.json,
/// knowledge-map.md}`, emits `agent:done` with a [`TopicCreated`], and returns
/// the same payload. On failure it emits `agent:error` with the reason and
/// returns `Err`; the workflow itself writes nothing.
#[tauri::command]
pub async fn chat_create_topic(app: AppHandle, topic: String) -> Result<TopicCreated, String> {
    let result = run_create_topic(&app, &topic).await;
    match result {
        Ok(created) => {
            let _ = app.emit(EVENT_DONE, &created);
            Ok(created)
        }
        Err(reason) => {
            let _ = app.emit(EVENT_ERROR, reason.clone());
            Err(reason)
        }
    }
}

/// Resolved, validated inputs for a single topic-creation run.
///
/// Produced by [`resolve_run_inputs`]; all guard logic (missing key, blank
/// model, no working folder) lives there so it can be unit-tested without
/// the keychain, appData, or network.
#[derive(Debug)]
struct TopicRunInputs {
    key: String,
    model: String,
    provider: Provider,
    base_url: Option<String>,
    working_folder: String,
}

/// Pure validation of the user's setup. No I/O — given an optional stored
/// key and the non-secret config, either resolve the run inputs or return a
/// human-readable error. Separated from [`run_create_topic`] so the guards
/// are testable without the OS keychain / appData / network.
fn resolve_run_inputs(key: Option<String>, config: AppConfig) -> Result<TopicRunInputs, String> {
    let key = key.ok_or_else(|| "No API key is saved. Open Settings to add one.".to_string())?;
    if key.trim().is_empty() {
        return Err("No API key is saved. Open Settings to add one.".into());
    }
    if config.model.trim().is_empty() {
        return Err("No model configured. Set a model id in Settings.".into());
    }
    let working_folder = config
        .last_working_folder
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .cloned()
        .ok_or_else(|| "No working folder selected. Pick a folder first.".to_string())?;
    Ok(TopicRunInputs {
        key,
        model: config.model,
        provider: config.provider,
        base_url: config.base_url,
        working_folder,
    })
}

/// Pure orchestration of one topic-creation run, separated from
/// [`chat_create_topic`] so the event bookkeeping stays out of the business
/// logic.
async fn run_create_topic(app: &AppHandle, topic: &str) -> Result<TopicCreated, String> {
    // 1. Gather keychain + config, then validate via the pure helper.
    let key = keychain::read_key().map_err(|e| e.to_string())?;
    let config = load_config(app).map_err(|e| e.to_string())?;
    let inputs = resolve_run_inputs(key, config)?;

    // 2. Build the BYOK client and run the learn-topic workflow.
    let client = LocalModelClient::new(inputs.provider, inputs.key, inputs.base_url, inputs.model);
    let state = learn_topic(&client, topic)
        .await
        .map_err(|e| e.to_string())?;

    // 3. Persist under `.learn/topics/<slug>/`. `write_state` creates the dir
    //    and writes both files atomically (both or neither).
    let dir = PathBuf::from(inputs.working_folder)
        .join(".learn")
        .join("topics")
        .join(&state.slug);
    write_state(&dir, &state).map_err(|e| e.to_string())?;

    Ok(TopicCreated {
        slug: state.slug,
        topic: state.topic,
        dir: dir.to_string_lossy().into_owned(),
    })
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(model: &str, folder: Option<&str>) -> AppConfig {
        AppConfig {
            provider: Provider::OpenAi,
            model: model.into(),
            base_url: None,
            last_working_folder: folder.map(String::from),
        }
    }

    #[test]
    fn missing_key_is_rejected() {
        let err = resolve_run_inputs(None, cfg("gpt-4o", Some("/x"))).unwrap_err();
        assert!(err.contains("API key"), "{err}");
    }

    #[test]
    fn blank_key_is_rejected() {
        // A stored-but-empty key must not sneak through to a confusing 401.
        let err = resolve_run_inputs(Some("   ".into()), cfg("gpt-4o", Some("/x"))).unwrap_err();
        assert!(err.contains("API key"), "{err}");
    }

    #[test]
    fn empty_model_is_rejected() {
        let err = resolve_run_inputs(Some("k".into()), cfg("   ", Some("/x"))).unwrap_err();
        assert!(err.contains("model"), "{err}");
    }

    #[test]
    fn missing_working_folder_is_rejected() {
        let err = resolve_run_inputs(Some("k".into()), cfg("gpt-4o", None)).unwrap_err();
        assert!(err.contains("working folder"), "{err}");
    }

    #[test]
    fn blank_working_folder_is_rejected() {
        let err = resolve_run_inputs(Some("k".into()), cfg("gpt-4o", Some("   "))).unwrap_err();
        assert!(err.contains("working folder"), "{err}");
    }

    #[test]
    fn valid_inputs_are_resolved() {
        let inputs =
            resolve_run_inputs(Some("sk-key".into()), cfg("gpt-4o", Some("/home/me/learn")))
                .unwrap();
        assert_eq!(inputs.key, "sk-key");
        assert_eq!(inputs.model, "gpt-4o");
        assert_eq!(inputs.provider, Provider::OpenAi);
        assert_eq!(inputs.working_folder, "/home/me/learn");
        assert!(inputs.base_url.is_none());
    }
}
