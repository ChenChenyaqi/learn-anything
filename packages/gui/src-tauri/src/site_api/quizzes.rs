//! Quiz readers — `build_quiz_list` and `read_quiz_deck`, ported from
//! `serve.mjs`. Concept groups look up display names from `state.json`; files
//! within a group sort filename-descending (newest first), groups sort by
//! concept name ascending.
//!
//! Path-traversal protection on `read_quiz_deck` matches the JS
//! `serveQuizDeck`: `..` components rejected outright, then canonicalize +
//! prefix check against the topic's `quizzes/` root.

use std::path::Path;

use super::model::{QuizFile, QuizGroup, QuizList, StateV1};
use super::topics::{build_concept_name_map, list_dir_names, read_json};

/// Scan `<topic>/quizzes/<concept>/*.json` and group by concept. Returns
/// `None` only when the *topic* directory doesn't exist (mirrors
/// `serve.mjs::buildQuizList`, which returns `null` for a missing topic → 404
/// in the command layer). A topic whose `quizzes/` dir is absent yields an
/// empty `QuizList` (200, not 404).
pub(super) fn build_quiz_list(slug: &str, topics_dir: &Path) -> Option<QuizList> {
    let topic_dir = topics_dir.join(slug);
    if !topic_dir.is_dir() {
        return None;
    }
    let state: StateV1 = read_json(&topic_dir.join("state.json")).unwrap_or_default();
    let name_map = build_concept_name_map(&state);

    let quizzes_dir = topic_dir.join("quizzes");
    let mut groups = Vec::new();
    for concept_slug in list_dir_names(&quizzes_dir) {
        let concept_dir = quizzes_dir.join(&concept_slug);
        if !concept_dir.is_dir() {
            continue;
        }
        let mut files = Vec::new();
        for f in list_dir_names(&concept_dir) {
            if f.ends_with(".json") {
                files.push(QuizFile {
                    filename: f.clone(),
                    path: format!("/topics/{slug}/quizzes/{concept_slug}/{f}"),
                });
            }
        }
        if files.is_empty() {
            continue;
        }
        files.sort_by(|a, b| b.filename.cmp(&a.filename));
        groups.push(QuizGroup {
            concept_slug: concept_slug.clone(),
            concept_name: name_map
                .get(&concept_slug)
                .cloned()
                .unwrap_or(concept_slug),
            files,
        });
    }
    groups.sort_by(|a, b| a.concept_name.cmp(&b.concept_name));
    Some(QuizList { groups })
}

/// Resolve and read a single quiz deck JSON file under
/// `<topic>/quizzes/<rest>`. Returns:
/// - `Ok(Some(value))` on a hit (parsed JSON passed through verbatim).
/// - `Ok(None)` when the file does not exist or is unreadable as JSON.
/// - `Err(())` when `rest` attempts path traversal (`..` present, or
///   canonicalization escapes the quizzes root). The caller maps it to
///   `"403|..."`.
///
/// `rest` is the path relative to `<topic>/quizzes/`, e.g. `"promise/quiz-2026-06-23-080000.json"`.
pub(super) fn read_quiz_deck(topic: &str, rest: &str, topics_dir: &Path) -> Result<Option<serde_json::Value>, ()> {
    let topic_dir = topics_dir.join(topic);
    if !topic_dir.is_dir() {
        return Ok(None);
    }
    // Reject `..` outright — matches `serve.mjs`'s `restPath.includes('..')`.
    if rest.split('/').any(|c| c == "..") {
        return Err(());
    }
    let quizzes_root = topic_dir.join("quizzes");
    let quizzes_canon = quizzes_root.canonicalize().unwrap_or_else(|_| quizzes_root.clone());
    let candidate_canon = match quizzes_root.join(rest).canonicalize() {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };
    if !candidate_canon.starts_with(&quizzes_canon) {
        return Err(());
    }
    match read_json::<serde_json::Value>(&candidate_canon) {
        Some(v) => Ok(Some(v)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write_state(topic_dir: &Path, json: &str) {
        fs::write(topic_dir.join("state.json"), json).unwrap();
    }

    #[test]
    fn quiz_list_topic_missing_returns_none() {
        let root = tempdir().unwrap();
        assert!(build_quiz_list("nope", root.path()).is_none());
    }

    #[test]
    fn quiz_list_no_quizzes_dir_returns_empty() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join("js")).unwrap();
        write_state(&root.path().join("js"), r#"{"topic":"JS"}"#);
        let list = build_quiz_list("js", root.path()).unwrap();
        assert!(list.groups.is_empty());
    }

    #[test]
    fn quiz_list_groups_sorted_by_concept_name() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js");
        fs::create_dir_all(topic.join("quizzes").join("z-slug")).unwrap();
        fs::create_dir_all(topic.join("quizzes").join("a-slug")).unwrap();
        fs::write(
            topic.join("quizzes").join("z-slug").join("q1.json"),
            "{}",
        ).unwrap();
        fs::write(
            topic.join("quizzes").join("a-slug").join("q2.json"),
            "{}",
        ).unwrap();
        write_state(
            &topic,
            r#"{"topic":"JS","domains":[{"name":"D","concepts":[
               {"name":"Alpha","slug":"a-slug"},
               {"name":"Zed","slug":"z-slug"}]}]}"#,
        );
        let list = build_quiz_list("js", root.path()).unwrap();
        assert_eq!(list.groups.len(), 2);
        assert_eq!(list.groups[0].concept_name, "Alpha");
        assert_eq!(list.groups[1].concept_name, "Zed");
    }

    #[test]
    fn quiz_files_sort_descending_filename() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js");
        fs::create_dir_all(topic.join("quizzes").join("c")).unwrap();
        for n in ["quiz-a.json", "quiz-b.json", "quiz-c.json"] {
            fs::write(topic.join("quizzes").join("c").join(n), "{}").unwrap();
        }
        write_state(&topic, r#"{"topic":"JS"}"#);
        let list = build_quiz_list("js", root.path()).unwrap();
        let names: Vec<_> = list.groups[0].files.iter().map(|f| &f.filename).cloned().collect();
        assert_eq!(names, vec!["quiz-c.json", "quiz-b.json", "quiz-a.json"]);
    }

    #[test]
    fn quiz_deck_traversal_with_dotdot_rejected() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js");
        fs::create_dir_all(topic.join("quizzes").join("promise")).unwrap();
        fs::write(topic.join("quizzes").join("promise").join("ok.json"), "{}").unwrap();
        fs::write(topic.parent().unwrap().join("secret.json"), "{}").ok();
        let res = read_quiz_deck("js", "../secret.json", root.path());
        assert_eq!(res, Err(()));
    }

    #[test]
    fn quiz_deck_valid_returns_value() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js");
        fs::create_dir_all(topic.join("quizzes").join("promise")).unwrap();
        fs::write(
            topic.join("quizzes").join("promise").join("q.json"),
            r#"{"title":"hi"}"#,
        ).unwrap();
        let v = read_quiz_deck("js", "promise/q.json", root.path()).unwrap();
        assert!(v.is_some());
        assert_eq!(v.unwrap()["title"], "hi");
    }

    #[test]
    fn quiz_deck_missing_file_returns_none() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js");
        fs::create_dir_all(topic.join("quizzes")).unwrap();
        fs::create_dir_all(&topic).unwrap();
        write_state(&topic, r#"{"topic":"JS"}"#);
        let v = read_quiz_deck("js", "nope/missing.json", root.path());
        assert_eq!(v, Ok(None));
    }
}