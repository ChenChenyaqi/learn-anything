//! Tauri commands that touch BOTH the keychain and the model client.
//!
//! Kept separate from [`crate::keychain`] (keychain-only) and [`crate::config`]
//! (config-only) so those modules stay single-purpose.

use std::time::Duration;

use futures::StreamExt;
use learn_agent::model::{LocalModelClient, ModelClient, Provider};
use serde::Deserialize;
use tauri::AppHandle;
use tokio::time::timeout;

use crate::{config::load_config, keychain};

/// A deliberately tiny prompt: proves the key + endpoint + model work with the
/// fewest possible tokens.
const TEST_SYSTEM: &str = "You are a connection test. Reply with exactly: ok";
const TEST_USER: &str = "ping";
/// Stop after this many bytes so a misbehaving stream can't run away.
const TEST_MAX_BYTES: usize = 256;
/// Wall-clock cap applied to each blocking step (connecting + each streamed
/// delta). A misbehaving provider that accepts the connection but never
/// responds would otherwise hang the command forever.
const TEST_STEP_TIMEOUT: Duration = Duration::from_secs(20);

/// Optional overrides for [`test_key`].
///
/// Every field is optional so the same command serves two flows:
/// - **Already configured**: call with `{}` → uses the stored key + saved config.
/// - **Setup screen (pre-save)**: pass the form values to test before saving.
#[derive(Clone, Default, Deserialize)]
#[serde(default)]
pub struct TestKeyParams {
    /// Test this key instead of the stored one.
    pub key: Option<String>,
    /// Override the configured provider.
    pub provider: Option<Provider>,
    /// Override the configured model id (falls back to config if empty).
    pub model: Option<String>,
    /// Override the configured `base_url`.
    pub base_url: Option<String>,
}

/// Custom `Debug`: the `key` field is redacted so logging the params (e.g. via
/// `tracing`) can never leak the secret. Mirrors the redacting `Debug` already
/// used on [`LocalModelClient`].
impl std::fmt::Debug for TestKeyParams {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TestKeyParams")
            .field("key", &self.key.as_ref().map(|_| "<redacted>"))
            .field("provider", &self.provider)
            .field("model", &self.model)
            .field("base_url", &self.base_url)
            .finish()
    }
}

/// Verify a key by performing one short completion against the provider.
///
/// On success returns the model's reply text (concrete proof the request
/// round-tripped). On failure returns the underlying error reason. The API key
/// is never included in the returned reason, and [`LocalModelClient`]'s `Debug`
/// impl redacts the key if the client is ever formatted.
#[tauri::command]
pub async fn test_key(app: AppHandle, params: TestKeyParams) -> Result<String, String> {
    // ── Resolve the key: explicit override, else the stored one. ──
    let key = match params.key {
        Some(k) => k,
        None => match keychain::read_key().map_err(|e| e.to_string())? {
            Some(k) => k,
            None => {
                return Err("No API key is saved. Enter a key first.".into());
            }
        },
    };

    // ── Resolve provider / model / base_url from config, with overrides. ──
    let config = load_config(&app).map_err(|e| e.to_string())?;
    let provider = params.provider.unwrap_or(config.provider);
    let model = match params.model {
        Some(m) if !m.is_empty() => m,
        _ => config.model.clone(),
    };
    if model.is_empty() {
        return Err("No model configured. Set a model id first.".into());
    }
    let base_url = params.base_url.or(config.base_url);

    // ── Build the client and run one short streaming completion. ──
    let client = LocalModelClient::new(provider, key, base_url, model);
    // Cap the connect step so a provider that never opens the stream can't hang.
    let mut stream = timeout(TEST_STEP_TIMEOUT, client.stream(TEST_SYSTEM, TEST_USER))
        .await
        .map_err(|_| "Timed out connecting to the provider.".to_string())?
        .map_err(|e| e.to_string())?;

    let mut reply = String::new();
    loop {
        // Per-delta timeout so a connection that stalls mid-response also can't
        // hang. The byte cap below only bounds output size, not latency.
        let delta = match timeout(TEST_STEP_TIMEOUT, stream.next()).await {
            Ok(Some(d)) => d,
            Ok(None) => break,
            Err(_) => return Err("Timed out waiting for the provider to respond.".into()),
        };
        let delta = delta.map_err(|e| e.to_string())?;
        reply.push_str(&delta);
        if reply.len() >= TEST_MAX_BYTES {
            break;
        }
    }

    if reply.trim().is_empty() {
        return Err("Provider returned an empty response.".into());
    }
    Ok(reply)
}
