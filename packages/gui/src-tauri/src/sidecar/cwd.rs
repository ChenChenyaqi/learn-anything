//! Working-folder resolution for sidecar frames.

use tauri::AppHandle;

use crate::config;

fn resolve_cwd_from(
    working_folder: Option<String>,
    last_working_folder: Option<String>,
) -> Result<String, String> {
    if let Some(cwd) = working_folder.filter(|s| !s.trim().is_empty()) {
        return Ok(cwd);
    }
    last_working_folder
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "No working folder set. Choose a project folder first.".into())
}

pub(super) fn resolve_cwd(
    app: &AppHandle,
    working_folder: Option<String>,
) -> Result<String, String> {
    let config = config::load_config(app).map_err(|e| e.to_string())?;
    resolve_cwd_from(working_folder, config.last_working_folder)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_cwd_from_arg_takes_priority() {
        let cwd = resolve_cwd_from(Some("/arg/path".into()), Some("/config/path".into()));
        assert_eq!(cwd.unwrap(), "/arg/path");
    }

    #[test]
    fn resolve_cwd_from_config_fallback() {
        let cwd = resolve_cwd_from(None, Some("/config/path".into()));
        assert_eq!(cwd.unwrap(), "/config/path");
    }

    #[test]
    fn resolve_cwd_from_neither_errors() {
        let cwd = resolve_cwd_from(None, None);
        assert!(cwd.is_err());
        assert!(cwd.unwrap_err().contains("No working folder"));
    }

    #[test]
    fn resolve_cwd_from_blank_arg_falls_through() {
        let cwd = resolve_cwd_from(Some("  ".into()), Some("/config/path".into()));
        assert_eq!(cwd.unwrap(), "/config/path");
    }

    #[test]
    fn resolve_cwd_from_blank_both_errors() {
        let cwd = resolve_cwd_from(Some("  ".into()), Some("".into()));
        assert!(cwd.is_err());
    }

    #[test]
    fn no_working_folder_error_message_is_actionable() {
        let err = resolve_cwd_from(None, None).unwrap_err();
        assert!(err.contains("working folder"));
        assert!(err.contains("project folder"));
    }
}
