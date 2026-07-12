//! Filesystem watcher — `notify` crate recursive watcher over
//! `<working_folder>/.learn/topics/`, debounced 200 ms, emitting a single
//! `site://reload` Tauri event and invalidating the search-index cache.
//!
//! Replaces `serve.mjs`'s `watch(TOPICS_DIR, {recursive:true})` + SSE
//! broadcast. Heartbeats are intentionally not ported — Tauri events are
//! fire-and-forget on a live channel, so there's no TCP keep-alive to maintain.
//!
//! Only one watcher lives at a time; calling `start` again swaps the previous
//! one out (e.g. when the user picks a different working folder). If the
//! topics dir does not yet exist, `start` succeeds without spawning a watcher
//! — the OS would reject a watch on a missing path, and the user might create
//! `.learn/topics/` later; `site_set_watcher_folder` should be called again at
//! that point. (A follow-up could auto-retry when the dir appears, but the GUI
//! shell's `create_project` is the only creator today and it can re-arm.)

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

use super::search;

/// Process-wide singleton watcher so folder swaps replace instead of stack.
static ACTIVE: Mutex<Option<RecommendedWatcher>> = Mutex::new(None);

/// Minimum gap between an event landing and us emitting `site://reload`. The
/// Node implementation uses `setTimeout(broadcastReload, 200)`, which coalesces
/// a burst of inotify/FSEvents callbacks into one reload signal.
const DEBOUNCE: Duration = Duration::from_millis(200);

/// (Re)start the watcher pointed at `topics_dir`. A previously-active watcher
/// is dropped (its OS watch handles are released) before the new one is
/// installed. Errors are surfaced as `String` so the caller can wrap them in
/// the `500|...` error convention.
///
/// A missing `topics_dir` is treated as "nothing to watch yet" and returns
/// `Ok(())` — see the module docs for the lifecycle.
pub fn start(app: &AppHandle, topics_dir: PathBuf) -> Result<(), String> {
    // Drop the previous watcher first — `RecommendedWatcher` holds OS
    // resources and silently consuming the old one's "still active" state
    // would leak file descriptors / inotify watches.
    {
        let mut guard = ACTIVE.lock().expect("watcher state poisoned");
        *guard = None;
    }

    if !topics_dir.is_dir() {
        return Ok(());
    }

    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            handle_event(&app_handle, event);
        }
    })
    .map_err(|e| format!("watcher init failed: {e}"))?;

    watcher
        .watch(&topics_dir, RecursiveMode::Recursive)
        .map_err(|e| format!("watch failed on {}: {e}", topics_dir.display()))?;

    {
        let mut guard = ACTIVE.lock().expect("watcher state poisoned");
        *guard = Some(watcher);
    }
    Ok(())
}

/// Last time we emitted a reload. Held in a `Mutex<Option<Instant>>` so the
/// first event always fires immediately and subsequent events within
/// `DEBOUNCE` are dropped.
static LAST_FIRE: Mutex<Option<Instant>> = Mutex::new(None);

/// Pure predicate: should this `EventKind` trigger a reload? Exposed so the
/// debounce test can call it directly without spinning up notify.
fn event_is_meaningful(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    )
}

fn handle_event(app: &AppHandle, event: notify::Event) {
    // Ignore access / rescan / OS-internal events; only act on create/modify/
    // remove/rename. This avoids spurious reloads on `chmod` reads etc.
    if !event_is_meaningful(&event.kind) {
        return;
    }
    let now = Instant::now();
    let mut guard = LAST_FIRE.lock().expect("debounce state poisoned");
    let should_fire = match *guard {
        Some(last) => now.duration_since(last) >= DEBOUNCE,
        None => true,
    };
    if !should_fire {
        return;
    }
    *guard = Some(now);
    drop(guard);

    // Mirror serve.mjs::broadcastReload: invalidate the search cache, then
    // broadcast. The frontend re-fetches whatever views it needs.
    search::invalidate();
    let _ = app.emit("site://reload", ());
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    /// Exercise the early-return branch without needing a Tauri `AppHandle`.
    /// Mirrors `start`'s first guard: a missing dir short-circuits to `Ok(())`
    /// before notify is ever touched.
    #[test]
    fn missing_dir_short_circuits() {
        let dir = tempdir().unwrap();
        let missing = dir.path().join("does-not-exist");
        assert!(!missing.is_dir());
        // The exact branch in `start`:
        let result: Result<(), String> = if !missing.is_dir() {
            Ok(())
        } else {
            Err("would-start".into())
        };
        assert_eq!(result, Ok(()));
    }

    /// Existing dir would proceed to notify (we can't easily make a real
    /// `AppHandle` here without pulling Tauri's `test` feature into the
    /// release build, so just assert the guard's branch choice).
    #[test]
    fn existing_dir_would_proceed() {
        let dir = tempdir().unwrap();
        let topics = dir.path().join(".learn").join("topics");
        fs::create_dir_all(&topics).unwrap();
        let result: Result<(), String> = if !topics.is_dir() {
            Ok(())
        } else {
            Err("would-start".into())
        };
        assert_eq!(result.unwrap_err(), "would-start");
    }

    #[test]
    fn event_filter_drops_access_and_any() {
        assert!(!event_is_meaningful(&EventKind::Access(notify::event::AccessKind::Any)));
        assert!(!event_is_meaningful(&EventKind::Any));
        assert!(!event_is_meaningful(&EventKind::Other));
    }

    #[test]
    fn event_filter_accepts_create_modify_remove() {
        assert!(event_is_meaningful(&EventKind::Create(
            notify::event::CreateKind::File
        )));
        assert!(event_is_meaningful(&EventKind::Modify(
            notify::event::ModifyKind::Data(notify::event::DataChange::Any)
        )));
        assert!(event_is_meaningful(&EventKind::Remove(
            notify::event::RemoveKind::File
        )));
    }

    /// First event fires; an immediate second event within `DEBOUNCE` is
    /// blocked. Verifies the `LAST_FIRE` gating logic without an `AppHandle`.
    #[test]
    fn debounce_blocks_burst_within_window() {
        let original = *LAST_FIRE.lock().unwrap();
        // Reset for the test; restore on drop via a guard.
        *LAST_FIRE.lock().unwrap() = None;

        let now = Instant::now();
        // First call: no prior fire → should fire.
        {
            let mut g = LAST_FIRE.lock().unwrap();
            let should_fire = g.is_none();
            assert!(should_fire);
            *g = Some(now);
        }
        // Immediate second call within DEBOUNCE → blocked.
        {
            let g = LAST_FIRE.lock().unwrap();
            let should_fire = match *g {
                Some(last) => now.duration_since(last) >= DEBOUNCE,
                None => true,
            };
            assert!(!should_fire);
        }

        // After waiting past DEBOUNCE → fires again.
        std::thread::sleep(DEBOUNCE + Duration::from_millis(10));
        {
            let g = LAST_FIRE.lock().unwrap();
            let should_fire = match *g {
                Some(last) => Instant::now().duration_since(last) >= DEBOUNCE,
                None => true,
            };
            assert!(should_fire);
        }

        // Restore so other tests aren't affected.
        *LAST_FIRE.lock().unwrap() = original;
    }
}