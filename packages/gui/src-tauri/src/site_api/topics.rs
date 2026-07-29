//! Topic readers — `build_topic_summaries` and `build_topic_data`.
//!
//! `build_topic_data` returns a recursive physical file tree as flat relative
//! paths (`files: { sessions, exercises, quizzes }`), mirroring cli/site
//! PR126's pure-mirror approach so arbitrary nesting depth renders correctly.
//! The old fixed-depth domain/concept grouping (sessions keyed by domain dir,
//! exercises grouped by concept) was retired.
//!
//! Unlike `project.rs` (which is the GUI shell's lightweight folder-validator
//! and *enforces* `state.json` version == 1), this module is a pure data
//! reader: it returns whatever it finds, never rejects a folder by version.
//! The user chose to keep the two surfaces independent.

use std::path::Path;

use super::model::{Concept, Domain, StateV1, TopicData, TopicFiles, TopicSummary};

/* ------------------------------------------------------------------ */
/*  Small fs helpers (errors → None, matching serve.mjs's safeRead*) */
/* ------------------------------------------------------------------ */

pub(super) fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Option<T> {
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub(super) fn read_text(path: &Path) -> Option<String> {
    std::fs::read_to_string(path).ok()
}

/// Git-style binary heuristic: read the first 8 KB and treat any NUL byte as a
/// binary marker. Read errors map to "not binary" so we never hide a file by
/// accident (matches `serve.mjs::isBinaryFile`).
pub(super) fn is_binary_file(path: &Path) -> bool {
    let Ok(mut f) = std::fs::File::open(path) else {
        return false;
    };
    use std::io::Read;
    let mut buf = [0u8; 8000];
    match f.read(&mut buf) {
        Ok(n) => buf[..n].contains(&0),
        Err(_) => false,
    }
}

/// `readdir` returning only directory entry names (non-recursive). Errors and
/// non-UTF-8 names are silently skipped, mirroring `readdirSync(...).filter`
/// patterns in `serve.mjs`.
pub(super) fn list_dir_names(dir: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        if let Some(name) = entry.file_name().to_str() {
            out.push(name.to_string());
        }
    }
    out
}

/// Names always excluded from the recursive file scan (mirrors cli/site
/// PR126's `EXCLUDED_NAMES`).
const EXCLUDED_NAMES: &[&str] = &[".learn", ".git", ".idea", "node_modules"];

/// Reject dot-dirs and the known noise set. Hidden directories (`.learn`,
/// `.git`, …) and dependency dirs are never part of a topic's learning content.
fn is_excluded(name: &str) -> bool {
    name.starts_with('.') || EXCLUDED_NAMES.contains(&name)
}

/// Recursive directory walk mirroring cli/site PR126's `walkDir`. Collects flat
/// relative paths (prefixed with `rel_prefix`, e.g. `sessions/js/es6/func.md`)
/// for files passing `filter`. Dot-dirs / known noise dirs / symlinks are
/// skipped. Binary files are skipped unless `include_binary`. Read errors on a
/// single entry are silently skipped so one unreadable file never hides the rest
/// — matching the JS `readdirSync` flatten + `continue` pattern.
///
/// `filter` is a concrete `fn` pointer (not generic) so recursion can't trigger
/// unbounded monomorphization. The non-capturing closures passed by
/// `scan_topic_files` coerce to `fn(&str) -> bool` for free.
fn walk_dir(dir: &Path, rel_prefix: &str, include_binary: bool, filter: fn(&str) -> bool, results: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let Some(name) = file_name.to_str() else {
            continue;
        };
        if is_excluded(name) {
            continue;
        }
        let ft = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        if ft.is_symlink() {
            continue;
        }
        let rel = if rel_prefix.is_empty() {
            name.to_string()
        } else {
            format!("{rel_prefix}/{name}")
        };
        if ft.is_dir() {
            walk_dir(&entry.path(), &rel, include_binary, filter, results);
        } else if ft.is_file() && filter(name) {
            if include_binary || !is_binary_file(&entry.path()) {
                results.push(rel);
            }
        }
    }
}

/// Recursively collect the three file axes for a topic into flat relative
/// paths. Sessions = `.md` (binary included); exercises = all non-binary files;
/// quizzes = `.json` (binary included). Extension matching is ASCII-case-
/// insensitive to mirror the JS `name.toLowerCase().endsWith(...)` leniency.
fn scan_topic_files(topic_dir: &Path) -> TopicFiles {
    let mut files = TopicFiles::default();
    walk_dir(
        &topic_dir.join("sessions"),
        "sessions",
        true,
        |n: &str| n.to_ascii_lowercase().ends_with(".md"),
        &mut files.sessions,
    );
    walk_dir(
        &topic_dir.join("exercises"),
        "exercises",
        false,
        |_| true,
        &mut files.exercises,
    );
    walk_dir(
        &topic_dir.join("quizzes"),
        "quizzes",
        true,
        |n: &str| n.to_ascii_lowercase().ends_with(".json"),
        &mut files.quizzes,
    );
    files
}

/* ------------------------------------------------------------------ */
/*  build_topic_summaries                                             */
/* ------------------------------------------------------------------ */

/// Build the `/api/topics` summary list. Topics with an unreadable or absent
/// `state.json` are skipped (never panic, never poison the folder).
///
/// Summaries are sorted by `name` (locale-naive byte comparison, matching
/// `serve.mjs`'s `localeCompare` default).
pub(super) fn build_topic_summaries(topics_dir: &Path) -> Vec<TopicSummary> {
    let mut summaries = Vec::new();
    for name in list_dir_names(topics_dir) {
        let topic_dir = topics_dir.join(&name);
        if !topic_dir.is_dir() {
            continue;
        }
        let Some(state): Option<StateV1> = read_json(&topic_dir.join("state.json")) else {
            continue;
        };
        let all_concepts: Vec<&Concept> = state
            .domains
            .iter()
            .flat_map(|d: &Domain| d.concepts.iter())
            .collect();
        let total = all_concepts.len() as u64;
        let mastered = all_concepts
            .iter()
            .filter(|c| c.status == "mastered")
            .count() as u64;
        summaries.push(TopicSummary {
            slug: name.clone(),
            name: if state.topic.is_empty() { name } else { state.topic.clone() },
            domain_count: state.domains.len() as u64,
            total_concepts: total,
            mastered_count: mastered,
            percentage: if total > 0 { (mastered * 100 + total / 2) / total } else { 0 },
            // Ordered domain display names — drives the overview's per-topic
            // description line. Order matches state.json's `domains` array.
            domain_names: state.domains.iter().map(|d| d.name.clone()).collect(),
        });
    }
    summaries.sort_by(|a, b| a.name.cmp(&b.name));
    summaries
}

/* ------------------------------------------------------------------ */
/*  build_topic_data                                                  */
/* ------------------------------------------------------------------ */

/// Full `<topic>` payload: state, knowledge-map, and a recursive flat-path
/// file tree (`files: { sessions, exercises, quizzes }`).
///
/// Returns `None` when the topic directory itself does not exist (so the
/// command layer can turn that into a 404).
pub(super) fn build_topic_data(slug: &str, topics_dir: &Path) -> Option<TopicData> {
    let topic_dir = topics_dir.join(slug);
    if !topic_dir.is_dir() {
        return None;
    }

    // state.json — defaults if unreadable, matching the JS `safeReadJson`
    // returning null (the knowledge-map + file tree still load without it).
    let state: StateV1 = read_json(&topic_dir.join("state.json")).unwrap_or_default();

    let knowledge_map = read_text(&topic_dir.join("knowledge-map.md")).unwrap_or_default();

    let files = scan_topic_files(&topic_dir);

    Some(TopicData {
        state,
        knowledge_map,
        files,
    })
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write_state(topic_dir: &Path, json: &str) {
        fs::write(topic_dir.join("state.json"), json).unwrap();
    }

    #[test]
    fn summaries_skip_dirs_without_state() {
        let root = tempdir().unwrap();
        let topics = root.path().join(".learn").join("topics");
        fs::create_dir_all(topics.join("rust")).unwrap();
        fs::create_dir_all(topics.join("empty")).unwrap();
        write_state(
            &topics.join("rust"),
            r#"{"topic":"Rust","domains":[{"name":"Basics","concepts":[{"name":"x","slug":"x","status":"mastered"}]}]}"#,
        );
        let s = build_topic_summaries(&topics);
        assert_eq!(s.len(), 1);
        assert_eq!(s[0].slug, "rust");
        assert_eq!(s[0].domain_count, 1);
        assert_eq!(s[0].total_concepts, 1);
        assert_eq!(s[0].mastered_count, 1);
        assert_eq!(s[0].percentage, 100);
        assert_eq!(s[0].domain_names, vec!["Basics"]);
    }

    #[test]
    fn summaries_round_percentage() {
        let root = tempdir().unwrap();
        let topics = root.path().join(".learn").join("topics");
        fs::create_dir_all(topics.join("t")).unwrap();
        write_state(
            &topics.join("t"),
            r#"{"topic":"T","domains":[{"name":"d","concepts":[
               {"name":"a","slug":"a","status":"mastered"},
               {"name":"b","slug":"b","status":"unexplored"},
               {"name":"c","slug":"c","status":"unexplored"}]}]}"#,
        );
        let s = build_topic_summaries(&topics);
        // 1/3 = 33.33% → round to 33.
        assert_eq!(s[0].percentage, 33);
        assert_eq!(s[0].domain_names, vec!["d"]);
    }

    #[test]
    fn summaries_sort_by_name() {
        let root = tempdir().unwrap();
        let topics = root.path().join(".learn").join("topics");
        for slug in ["z", "a", "m"] {
            fs::create_dir_all(topics.join(slug)).unwrap();
            write_state(&topics.join(slug), &format!(r#"{{"topic":"{slug}"}}"#));
        }
        let s = build_topic_summaries(&topics);
        assert_eq!(s.iter().map(|x| &x.name).collect::<Vec<_>>(), vec!["a", "m", "z"]);
        // No domains declared → empty vec, never absent.
        assert!(s.iter().all(|x| x.domain_names.is_empty()));
    }

    #[test]
    fn topic_data_returns_none_for_missing() {
        let root = tempdir().unwrap();
        assert!(build_topic_data("nope", root.path()).is_none());
    }

    /// walk_dir collects in filesystem order (the JS tree builder sorts
    /// downstream), so tests assert on a sorted copy for determinism.
    fn sorted(mut v: Vec<String>) -> Vec<String> {
        v.sort();
        v
    }

    #[test]
    fn topic_data_scans_recursive_sessions() {
        // Nested sessions/ dir beyond one level — the exact case PR126 fixed.
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        fs::create_dir_all(topic_dir.join("sessions").join("js").join("es6")).unwrap();
        fs::create_dir_all(topic_dir.join("sessions").join("ownership")).unwrap();
        fs::write(topic_dir.join("sessions").join("js").join("es6").join("func.md"), "f").unwrap();
        fs::write(topic_dir.join("sessions").join("ownership").join("lifetimes.md"), "l").unwrap();
        fs::write(topic_dir.join("sessions").join("overview.md"), "o").unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);

        let data = build_topic_data("js", root.path()).unwrap();
        assert_eq!(
            sorted(data.files.sessions),
            vec![
                "sessions/js/es6/func.md",
                "sessions/overview.md",
                "sessions/ownership/lifetimes.md",
            ]
        );
    }

    #[test]
    fn topic_data_scans_deeply_nested_exercises() {
        // 4-level nesting: exercises/js/es6/func/arrow-func/index.js
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        fs::create_dir_all(
            topic_dir.join("exercises").join("js").join("es6").join("func").join("arrow-func"),
        )
        .unwrap();
        fs::write(
            topic_dir
                .join("exercises")
                .join("js")
                .join("es6")
                .join("func")
                .join("arrow-func")
                .join("index.js"),
            "const f = (a, b) => a + b;",
        )
        .unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);

        let data = build_topic_data("js", root.path()).unwrap();
        assert_eq!(
            data.files.exercises,
            vec!["exercises/js/es6/func/arrow-func/index.js"]
        );
    }

    #[test]
    fn topic_data_scans_recursive_quizzes_with_unicode_dir() {
        // Unicode directory name (mirrors the cli/site fixture 异步Promise).
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        fs::create_dir_all(topic_dir.join("quizzes").join("异步Promise")).unwrap();
        fs::create_dir_all(topic_dir.join("quizzes").join("js").join("es6").join("promise")).unwrap();
        fs::write(topic_dir.join("quizzes").join("异步Promise").join("quiz.json"), "{}").unwrap();
        fs::write(
            topic_dir.join("quizzes").join("js").join("es6").join("promise").join("quiz.json"),
            "{}",
        )
        .unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);

        let data = build_topic_data("js", root.path()).unwrap();
        assert_eq!(
            sorted(data.files.quizzes),
            vec![
                "quizzes/js/es6/promise/quiz.json",
                "quizzes/异步Promise/quiz.json",
            ]
        );
    }

    #[test]
    fn topic_data_filters_binary_from_exercises_but_keeps_in_sessions() {
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        // A binary file under exercises/ is dropped (include_binary=false).
        fs::create_dir_all(topic_dir.join("exercises").join("c")).unwrap();
        fs::write(topic_dir.join("exercises").join("c").join("text.md"), "hello").unwrap();
        fs::write(topic_dir.join("exercises").join("c").join("bin.dat"), b"hello\0world").unwrap();
        // The same binary under sessions/ stays (.md is the filter; binary ok).
        fs::create_dir_all(topic_dir.join("sessions")).unwrap();
        fs::write(topic_dir.join("sessions").join("note.md"), b"hi\0there").unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);

        let data = build_topic_data("js", root.path()).unwrap();
        assert_eq!(data.files.exercises, vec!["exercises/c/text.md"]);
        assert_eq!(data.files.sessions, vec!["sessions/note.md"]);
    }

    #[test]
    fn topic_data_excludes_dotfiles_and_noise_dirs() {
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        // Real content.
        fs::create_dir_all(topic_dir.join("sessions").join("core")).unwrap();
        fs::write(topic_dir.join("sessions").join("core").join("a.md"), "A").unwrap();
        // Noise dirs must be skipped (not walked, not collected).
        fs::create_dir_all(topic_dir.join("sessions").join(".learn").join("x")).unwrap();
        fs::write(topic_dir.join("sessions").join(".learn").join("x").join("leak.md"), "L").unwrap();
        fs::create_dir_all(topic_dir.join("sessions").join("node_modules").join("pkg")).unwrap();
        fs::write(
            topic_dir.join("sessions").join("node_modules").join("pkg").join("leak.md"),
            "L",
        )
        .unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);

        let data = build_topic_data("js", root.path()).unwrap();
        assert_eq!(data.files.sessions, vec!["sessions/core/a.md"]);
    }

    #[test]
    fn topic_data_excludes_symlinks() {
        // Symlinked dirs/files are not followed (mirrors PR126 isSymbolicLink()).
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let root = tempdir().unwrap();
            let topic_dir = root.path().join("js");
            fs::create_dir_all(topic_dir.join("sessions").join("real")).unwrap();
            fs::write(topic_dir.join("sessions").join("real").join("a.md"), "A").unwrap();
            // A symlink pointing OUTSIDE the topic — must not be traversed.
            let outside = root.path().join("outside.md");
            fs::write(&outside, "evil").unwrap();
            symlink(&outside, topic_dir.join("sessions").join("link.md")).unwrap();
            write_state(&topic_dir, r#"{"topic":"JS"}"#);

            let data = build_topic_data("js", root.path()).unwrap();
            assert_eq!(data.files.sessions, vec!["sessions/real/a.md"]);
        }
        // No-op on non-unix (Windows symlink semantics differ in CI).
    }

    #[test]
    fn topic_data_returns_empty_files_when_dirs_absent() {
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        fs::create_dir_all(&topic_dir).unwrap();
        fs::write(topic_dir.join("knowledge-map.md"), "KM").unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);

        let data = build_topic_data("js", root.path()).unwrap();
        assert!(data.files.sessions.is_empty());
        assert!(data.files.exercises.is_empty());
        assert!(data.files.quizzes.is_empty());
        assert_eq!(data.knowledge_map, "KM");
    }

    #[test]
    fn summaries_carry_domain_names_in_state_order() {
        // The overview's per-topic description line joins these names, so the
        // order must follow state.json's `domains` array exactly (not be
        // re-sorted), so the user's chosen grouping is what they see.
        let root = tempdir().unwrap();
        let topics = root.path().join(".learn").join("topics");
        fs::create_dir_all(topics.join("rust")).unwrap();
        write_state(
            &topics.join("rust"),
            r#"{"topic":"Rust","domains":[
                {"name":"Ownership","concepts":[]},
                {"name":"Async","concepts":[]},
                {"name":"Traits","concepts":[]}
            ]}"#,
        );
        let s = build_topic_summaries(&topics);
        assert_eq!(s[0].domain_count, 3);
        assert_eq!(s[0].domain_names, vec!["Ownership", "Async", "Traits"]);
    }
}