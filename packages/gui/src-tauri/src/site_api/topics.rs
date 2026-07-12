//! Topic readers — `build_topic_summaries` and `build_topic_data`, ported
//! 1:1 from `serve.mjs` so the GUI's desktop UI gets exactly the same learning
//! state that the web dashboard did.
//!
//! Unlike `project.rs` (which is the GUI shell's lightweight folder-validator
//! and *enforces* `state.json` version == 1), this module is a pure data
//! reader: it returns whatever it finds, never rejects a folder by version.
//! The user chose to keep the two surfaces independent.

use std::path::Path;

use super::model::{
    Concept, Domain, ExerciseFile, ExerciseGroup, SessionFile, StateV1, TopicData, TopicSummary,
};

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

/// Like `list_dir_names`, but returns `(name, is_dir)` so callers can branch
/// the top-level sessions/exercises scan (root files vs. concept subdirs).
pub(super) fn list_entries(dir: &Path) -> Vec<(String, bool)> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if let Some(name) = entry.file_name().to_str() {
            out.push((name.to_string(), is_dir));
        }
    }
    out
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
        });
    }
    summaries.sort_by(|a, b| a.name.cmp(&b.name));
    summaries
}

/* ------------------------------------------------------------------ */
/*  build_topic_data                                                  */
/* ------------------------------------------------------------------ */

/// Map concept slug → display name from a `state.json` (exercises and quizzes
/// both need it).
pub(super) fn build_concept_name_map(state: &StateV1) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    for domain in &state.domains {
        for concept in &domain.concepts {
            map.insert(concept.slug.clone(), concept.name.clone());
        }
    }
    map
}

/// Full `<topic>` payload: state, knowledge-map, sessions (grouped by domain),
/// exercises (grouped by concept), plus root orphans for each.
///
/// Returns `None` when the topic directory itself does not exist (so the
/// command layer can turn that into a 404).
pub(super) fn build_topic_data(slug: &str, topics_dir: &Path) -> Option<TopicData> {
    let topic_dir = topics_dir.join(slug);
    if !topic_dir.is_dir() {
        return None;
    }

    // state.json — defaults if unreadable, matching `serve.mjs::safeReadJson`
    // returning null (the JS `if (!state) continue` skips, but here we still
    // return data so quizzes can reuse dir scans; exercises just won't get
    // display-name mapping).
    let state: StateV1 = read_json(&topic_dir.join("state.json"))
        .unwrap_or_default();

    let knowledge_map =
        read_text(&topic_dir.join("knowledge-map.md")).unwrap_or_default();

    // sessions/ — domain subdirs map domain dir name → .md files; root .md
    // files go to `root_sessions`.
    let sessions_dir = topic_dir.join("sessions");
    let mut sessions: std::collections::BTreeMap<String, Vec<SessionFile>> =
        std::collections::BTreeMap::new();
    let mut root_sessions = Vec::new();
    for (entry_name, is_dir) in list_entries(&sessions_dir) {
        if is_dir {
            let domain_dir = sessions_dir.join(&entry_name);
            let mut files = Vec::new();
            for f in list_dir_names(&domain_dir) {
                if f.ends_with(".md") {
                    files.push(SessionFile {
                        filename: f.clone(),
                        path: format!("/topics/{slug}/sessions/{entry_name}/{f}"),
                    });
                }
            }
            files.sort_by(|a, b| b.filename.cmp(&a.filename));
            // `serve.mjs` does `sessions[entry.name] = files` unconditionally —
            // a domain dir with no .md files still appears as an empty array
            // so the sidebar renders the (empty) domain. Match that.
            sessions.insert(entry_name, files);
        } else if entry_name.ends_with(".md") {
            root_sessions.push(SessionFile {
                filename: entry_name.clone(),
                path: format!("/topics/{slug}/sessions/{entry_name}"),
            });
        }
    }
    root_sessions.sort_by(|a, b| b.filename.cmp(&a.filename));

    // exercises/ — concept subdirs group files; binary files are skipped.
    let exercises_dir = topic_dir.join("exercises");
    let name_map = build_concept_name_map(&state);
    let mut exercises: Vec<ExerciseGroup> = Vec::new();
    let mut root_exercises = Vec::new();
    for (entry_name, is_dir) in list_entries(&exercises_dir) {
        if is_dir {
            let concept_dir = exercises_dir.join(&entry_name);
            let mut files = Vec::new();
            for f in list_dir_names(&concept_dir) {
                if !is_binary_file(&concept_dir.join(&f)) {
                    files.push(ExerciseFile {
                        name: f.clone(),
                        path: format!("/topics/{slug}/exercises/{entry_name}/{f}"),
                    });
                }
            }
            if !files.is_empty() {
                exercises.push(ExerciseGroup {
                    concept_slug: entry_name.clone(),
                    concept_name: name_map
                        .get(&entry_name)
                        .cloned()
                        .unwrap_or(entry_name),
                    files,
                });
            }
        } else if !is_binary_file(&exercises_dir.join(&entry_name)) {
            root_exercises.push(ExerciseFile {
                name: entry_name.clone(),
                path: format!("/topics/{slug}/exercises/{entry_name}"),
            });
        }
    }
    exercises.sort_by(|a, b| a.concept_name.cmp(&b.concept_name));

    Some(TopicData {
        state,
        knowledge_map,
        sessions,
        root_sessions,
        exercises,
        root_exercises,
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
    }

    #[test]
    fn topic_data_returns_none_for_missing() {
        let root = tempdir().unwrap();
        assert!(build_topic_data("nope", root.path()).is_none());
    }

    #[test]
    fn topic_data_groups_sessions_and_exercises() {
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        fs::create_dir_all(topic_dir.join("sessions").join("domain-a")).unwrap();
        fs::create_dir_all(topic_dir.join("sessions")).unwrap();
        fs::write(topic_dir.join("sessions").join("domain-a").join("b.md"), "B").unwrap();
        fs::write(topic_dir.join("sessions").join("domain-a").join("a.md"), "A").unwrap();
        fs::write(topic_dir.join("sessions").join("root.md"), "R").unwrap();

        fs::create_dir_all(topic_dir.join("exercises").join("concept-x")).unwrap();
        fs::write(topic_dir.join("exercises").join("concept-x").join("ex.md"), "E").unwrap();
        fs::write(topic_dir.join("knowledge-map.md"), "KM").unwrap();

        write_state(
            &topic_dir,
            r#"{"topic":"JS","domains":[
               {"name":"A","concepts":[{"name":"X","slug":"concept-x"}]}]}"#,
        );

        let data = build_topic_data("js", root.path()).unwrap();
        assert_eq!(data.state.topic, "JS");
        assert_eq!(data.knowledge_map, "KM");
        // domain-a files sorted filename-descending.
        let a = data.sessions.get("domain-a").unwrap();
        assert_eq!(a.iter().map(|f| f.filename.clone()).collect::<Vec<_>>(), vec!["b.md", "a.md"]);
        assert_eq!(data.root_sessions.len(), 1);
        assert_eq!(data.root_sessions[0].filename, "root.md");
        assert_eq!(data.exercises.len(), 1);
        assert_eq!(data.exercises[0].concept_slug, "concept-x");
        assert_eq!(data.exercises[0].concept_name, "X");
        assert_eq!(data.exercises[0].files[0].name, "ex.md");
    }

    #[test]
    fn binary_files_filtered_from_exercises() {
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        fs::create_dir_all(topic_dir.join("exercises").join("c")).unwrap();
        fs::write(topic_dir.join("exercises").join("c").join("text.md"), "hello").unwrap();
        fs::write(topic_dir.join("exercises").join("c").join("bin.md"), b"hello\0world").unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);
        let data = build_topic_data("js", root.path()).unwrap();
        let group = &data.exercises[0];
        assert_eq!(group.files.len(), 1);
        assert_eq!(group.files[0].name, "text.md");
    }

    #[test]
    fn empty_session_subdir_is_retained_as_empty_array() {
        // serve.mjs does `sessions[entry.name] = files` unconditionally — a
        // domain dir with zero .md files still shows up as an empty array.
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        fs::create_dir_all(topic_dir.join("sessions").join("empty-domain")).unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);
        let data = build_topic_data("js", root.path()).unwrap();
        assert!(data.sessions.contains_key("empty-domain"));
        assert!(data.sessions.get("empty-domain").unwrap().is_empty());
    }

    #[test]
    fn exercises_without_state_fall_back_to_slug_as_name() {
        let root = tempdir().unwrap();
        let topic_dir = root.path().join("js");
        fs::create_dir_all(topic_dir.join("exercises").join("orphan-concept")).unwrap();
        fs::write(topic_dir.join("exercises").join("orphan-concept").join("e.md"), "???").unwrap();
        write_state(&topic_dir, r#"{"topic":"JS"}"#);
        let data = build_topic_data("js", root.path()).unwrap();
        assert_eq!(data.exercises[0].concept_name, "orphan-concept");
    }
}