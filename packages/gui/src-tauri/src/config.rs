//! Non-secret application config, persisted as JSON in the OS app-data dir.
//!
//! Only settings that are NOT secret live here: provider, model id, optional
//! `base_url`, and the last chosen working folder. The API key itself is kept
//! in the OS keychain (see [`crate::keychain`]) and is NEVER written here.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Which LLM provider to use.
///
/// Serializes to lowercase strings (`"openai"` / `"anthropic"`) so it can be
/// stored in the app's plaintext config and round-tripped to/from the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    /// OpenAI-compatible (also works with OpenRouter, Azure OpenAI, local
    /// servers, etc. via an optional `base_url`).
    #[default]
    OpenAi,
    /// Anthropic (Claude).
    Anthropic,
}

/// Filename (relative to the app-data dir) holding the config.
const CONFIG_FILENAME: &str = "config.json";

/// Non-secret application config.
///
/// Every field has a serde default so a missing or partially-written config
/// file (e.g. from a future schema bump) still loads instead of bricking the
/// app.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    /// Which provider API to target (serialized as `"openai"` / `"anthropic"`).
    pub provider: Provider,
    /// The model id, e.g. `"gpt-4o"` or `"claude-sonnet-4-20250514"`.
    pub model: String,
    /// Optional provider endpoint override (OpenRouter, Azure OpenAI, etc.).
    pub base_url: Option<String>,
    /// The last chosen working folder (Phase 1 stores only one).
    pub last_working_folder: Option<String>,
}

impl AppConfig {
    /// Validate the fields that have a "correct" shape.
    ///
    /// Returns the first problem found as a human-readable string, or `Ok(())`
    /// if the config is sound. Called by [`set_config`] so bad values are
    /// rejected at save time with a clear message instead of surfacing later as
    /// a confusing provider error inside the agent sidecar.
    pub fn validate(&self) -> Result<(), String> {
        if self.model.trim().is_empty() {
            return Err("model must not be empty".into());
        }
        if let Some(url) = &self.base_url {
            let trimmed = url.trim();
            if trimmed.is_empty() {
                return Err("base_url must not be empty when present".into());
            }
            if url::Url::parse(trimmed).is_err() {
                return Err(format!("base_url is not a valid URL: {trimmed}"));
            }
        }
        Ok(())
    }
}

/// Resolve the path to the config file.
///
/// Does NOT create the app-data dir: a read should have no filesystem side
/// effects (and `std::fs::read` simply returns `NotFound`, which [`load_config`]
/// maps to defaults, if the dir doesn't exist yet).
fn config_path(app: &AppHandle) -> anyhow::Result<PathBuf> {
    Ok(app.path().app_data_dir()?.join(CONFIG_FILENAME))
}

/// Like [`config_path`], but also ensures the app-data dir exists. Used before
/// writing.
fn config_path_for_write(app: &AppHandle) -> anyhow::Result<PathBuf> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(CONFIG_FILENAME))
}

/// Load the config from app-data. Returns defaults if the file doesn't exist.
///
/// Used by the `get_config` Tauri command and internally by the agent sidecar
/// boot path (which reads provider/model/base_url to frame the first request).
pub fn load_config(app: &AppHandle) -> anyhow::Result<AppConfig> {
    let path = config_path(app)?;
    match std::fs::read(&path) {
        Ok(bytes) => {
            // `serde(default)` on the struct lets unknown/extra fields be
            // tolerated as long as the top-level is an object.
            let cfg: AppConfig = serde_json::from_slice(&bytes)?;
            Ok(cfg)
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(AppConfig::default()),
        Err(err) => Err(err.into()),
    }
}

/// Persist the config to app-data (atomically: write to temp then rename).
pub fn save_config(app: &AppHandle, cfg: &AppConfig) -> anyhow::Result<()> {
    let path = config_path_for_write(app)?;
    let bytes = serde_json::to_vec_pretty(cfg)?;
    // Atomic write so a crash mid-write can't corrupt the config.
    atomic_write(&path, &bytes)?;
    Ok(())
}

/// Write `bytes` to `path` via a temp file + `fsync` + rename, so the
/// destination is never observed in a half-written state and a crash right
/// after the rename can't lose the just-committed bytes.
///
/// The temp file lives in the same directory as the target so the rename stays
/// on one filesystem (avoids a cross-FS `EXDEV` failure). If the rename fails,
/// the temp file is removed so no orphan is left behind.
fn atomic_write(path: &PathBuf, bytes: &[u8]) -> anyhow::Result<()> {
    use std::io::Write;

    let dir = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("config path has no parent dir"))?;
    let tmp = dir.join(format!(
        ".{}.tmp",
        path.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("config")
    ));
    // Create + write + flush + fsync the temp file BEFORE renaming, so the
    // rename only ever promotes durably-written bytes.
    let mut file = std::fs::File::create(&tmp)?;
    file.write_all(bytes)?;
    file.flush()?;
    file.sync_all()?;
    drop(file);
    // Rename; clean up the temp file on failure so it can't accumulate.
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.into());
    }
    Ok(())
}

/* ───────────────────────── Tauri commands ───────────────────────── */

/// Return the current non-secret config (or defaults if none saved yet).
#[tauri::command]
pub fn get_config(app: AppHandle) -> Result<AppConfig, String> {
    load_config(&app).map_err(|e| e.to_string())
}

/// Replace the non-secret config with `config`.
///
    /// Validates the shape of the config first so obviously broken values (empty
    /// model, malformed `base_url`) are rejected up front with a clear message
    /// rather than failing opaquely later inside the agent sidecar boot.
#[tauri::command]
pub fn set_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    config.validate()?;
    save_config(&app, &config).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_openai_with_empty_model() {
        let cfg = AppConfig::default();
        assert_eq!(cfg.provider, Provider::OpenAi);
        assert!(cfg.model.is_empty());
        assert!(cfg.base_url.is_none());
        assert!(cfg.last_working_folder.is_none());
    }

    #[test]
    fn config_round_trips_through_json() {
        let cfg = AppConfig {
            provider: Provider::Anthropic,
            model: "claude-sonnet-4-20250514".into(),
            base_url: Some("https://proxy.example.com".into()),
            last_working_folder: Some("/home/me/learn".into()),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        // Provider serializes to lowercase per its serde rename.
        assert!(json.contains(r#""provider":"anthropic""#));
        let back: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back.provider, Provider::Anthropic);
        assert_eq!(back.model, "claude-sonnet-4-20250514");
        assert_eq!(back.base_url.as_deref(), Some("https://proxy.example.com"));
        assert_eq!(back.last_working_folder.as_deref(), Some("/home/me/learn"));
    }

    #[test]
    fn partial_json_still_loads_via_serde_default() {
        // An empty object should yield a fully-defaulted config, not an error.
        let cfg: AppConfig = serde_json::from_str("{}").unwrap();
        assert_eq!(cfg.provider, Provider::OpenAi);
        assert!(cfg.model.is_empty());
    }

    #[test]
    fn unknown_provider_string_errors() {
        let res: Result<AppConfig, _> = serde_json::from_str(r#"{"provider":"grok"}"#);
        assert!(res.is_err());
    }

    // ── set_config validation ──────────────────────────────────────

    #[test]
    fn validate_rejects_empty_model() {
        let cfg = AppConfig {
            model: "   ".into(),
            ..Default::default()
        };
        assert_eq!(cfg.validate(), Err("model must not be empty".into()));
    }

    #[test]
    fn validate_rejects_malformed_base_url() {
        let cfg = AppConfig {
            model: "gpt-4o".into(),
            base_url: Some("not a url".into()),
            ..Default::default()
        };
        let err = cfg.validate().unwrap_err();
        assert!(err.contains("valid URL"), "{err}");
    }

    #[test]
    fn validate_rejects_blank_base_url() {
        let cfg = AppConfig {
            model: "gpt-4o".into(),
            base_url: Some("   ".into()),
            ..Default::default()
        };
        assert!(cfg.validate().unwrap_err().contains("empty"));
    }

    #[test]
    fn validate_accepts_valid_base_url() {
        let cfg = AppConfig {
            model: "gpt-4o".into(),
            base_url: Some("https://api.openai.com/v1".into()),
            ..Default::default()
        };
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn validate_accepts_absent_base_url() {
        let cfg = AppConfig {
            model: "claude-sonnet-4-20250514".into(),
            ..Default::default()
        };
        assert!(cfg.validate().is_ok());
    }
}
