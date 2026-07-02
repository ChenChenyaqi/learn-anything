//! OS keychain storage for the user's LLM API key.
//!
//! The key is stored via the OS-native secure credential store (macOS
//! Keychain, Windows Credential Manager, Linux secret-service) using the
//! [`keyring`] crate. It is NEVER written to any plaintext file, env-var
//! config, or log.
//!
//! The credential is addressed by a stable service+user pair derived from the
//! app identifier so it survives upgrades.

use keyring::Entry;

/// Stable keychain "service" identifier (the app bundle id).
const SERVICE: &str = "com.learnanything.gui";
/// Stable keychain "user" identifier for the single stored API key.
const KEY_USER: &str = "llm-api-key";

/// Open the keychain entry that holds the API key.
///
/// Centralizing this keeps the service/user strings in one place so they can't
/// drift out of sync across `store`/`read`/`exists`.
fn entry() -> anyhow::Result<Entry> {
    Ok(Entry::new(SERVICE, KEY_USER)?)
}

/// Store the API key in the OS keychain.
pub fn store_key(key: &str) -> anyhow::Result<()> {
    let entry = entry()?;
    entry.set_password(key)?;
    Ok(())
}

/// Load the API key from the OS keychain.
///
/// Returns `Ok(None)` when no key has been stored (this is a normal state, not
/// an error, per the `agent-keychain` spec's "No key present" scenario).
pub fn read_key() -> anyhow::Result<Option<String>> {
    let entry = entry()?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(anyhow::anyhow!(e)),
    }
}

/// Whether a key is currently stored.
///
/// Note: the `keyring` crate exposes no cheap "exists" probe, so this performs
/// a full read under the hood. Use it to express intent ("should the setup
/// screen show?"), not as a performance optimization over [`read_key`].
pub fn has_stored_key() -> anyhow::Result<bool> {
    Ok(read_key()?.is_some())
}

/// Delete the stored API key, if any. Idempotent: a missing key is not an error.
pub fn remove_key() -> anyhow::Result<()> {
    let entry = entry()?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(anyhow::anyhow!(e)),
    }
}

/// Produce a non-secret preview of a key for display, e.g. `sk-…7X2J`.
///
/// Never reveals enough to reconstruct or use the key: short keys are fully
/// hidden, longer ones show only the first 3 and last 4 characters.
fn mask_key(key: &str) -> String {
    let chars: Vec<char> = key.chars().collect();
    let len = chars.len();
    if len <= 8 {
        format!("•••• ({} chars)", len)
    } else {
        let first: String = chars[..3].iter().collect();
        let last: String = chars[len - 4..].iter().collect();
        format!("{first}…{last}")
    }
}

/* ───────────────────────── Tauri commands ───────────────────────── */
//
// The command wrappers keep the frontend-facing invoke names (`save_key`,
// `load_key`, …); the engine functions above use distinct names so the two
// never shadow each other.

/// Save the user's API key to the OS keychain.
#[tauri::command]
pub fn save_key(key: String) -> Result<(), String> {
    store_key(&key).map_err(|e| e.to_string())
}

/// Return a non-secret preview of the stored key (e.g. `sk-…7X2J`), or `null`
/// if none is stored.
///
/// The raw key never crosses into the webview: [`test_key`](crate::commands::test_key)
/// reads it directly from the keychain when needed, so the frontend only ever
/// needs this masked hint for display (e.g. "a key is configured").
#[tauri::command]
pub fn load_key() -> Result<Option<String>, String> {
    Ok(read_key().map_err(|e| e.to_string())?.map(|k| mask_key(&k)))
}

/// Whether a key is currently stored (used to decide setup vs. chat view).
#[tauri::command]
pub fn has_key() -> Result<bool, String> {
    has_stored_key().map_err(|e| e.to_string())
}

/// Delete the stored API key.
#[tauri::command]
pub fn delete_key() -> Result<(), String> {
    remove_key().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // These tests exercise the real OS keychain. They are ignored by default so
    // CI / headless environments don't fail on missing secret-service, etc.
    // Run locally with: `cargo test --package learn-anything-gui -- --ignored keychain`
    #[test]
    #[ignore]
    fn key_round_trips_through_keychain() {
        // Clean slate.
        let _ = remove_key();
        assert!(!has_stored_key().unwrap());

        store_key("sk-test-12345").unwrap();
        assert!(has_stored_key().unwrap());
        assert_eq!(read_key().unwrap().as_deref(), Some("sk-test-12345"));

        remove_key().unwrap();
        assert!(!has_stored_key().unwrap());
        assert!(read_key().unwrap().is_none());
    }

    #[test]
    #[ignore]
    fn load_when_absent_is_none_not_error() {
        let _ = remove_key();
        assert!(read_key().unwrap().is_none());
        assert!(!has_stored_key().unwrap());
    }

    #[test]
    #[ignore]
    fn save_overwrites_existing_key() {
        store_key("first").unwrap();
        store_key("second").unwrap();
        assert_eq!(read_key().unwrap().as_deref(), Some("second"));
        remove_key().unwrap();
    }

    // ── masking (pure, no OS keychain) ─────────────────────────────

    #[test]
    fn mask_hides_short_keys_entirely() {
        let masked = mask_key("abc");
        assert!(masked.contains("3 chars"), "{masked}");
        assert!(!masked.contains("abc"), "{masked}");
    }

    #[test]
    fn mask_shows_only_the_ends_of_long_keys() {
        let masked = mask_key("sk-abcd-1234-WXYZ");
        // First 3 + last 4 visible; the middle must be hidden.
        assert!(masked.starts_with("sk-"), "{masked}");
        assert!(masked.ends_with("WXYZ"), "{masked}");
        assert!(!masked.contains("abcd"), "{masked}");
        assert!(!masked.contains("1234"), "{masked}");
    }
}
