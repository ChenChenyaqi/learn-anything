//! Single-quiz-deck reader — `read_quiz_deck`. The list/grouped scan
//! (`build_quiz_list`) was retired when quiz files folded into the recursive
//! `TopicData.files.quizzes` flat-path axis (mirrors cli/site PR126); the
//! frontend now plays a deck by fetching it straight from the path the file
//! tree already discovered.
//!
//! Path-traversal protection on `read_quiz_deck` matches the JS
//! `serveQuizDeck`: `..` components rejected outright, then canonicalize +
//! prefix check against the topic's `quizzes/` root.

use std::path::Path;

use super::topics::read_json;

/// Resolve and read a single quiz deck JSON file under
/// `<topic>/quizzes/<rest>`. Returns:
/// - `Ok(Some(value))` on a hit (parsed JSON passed through verbatim).
/// - `Ok(None)` when the file does not exist or is unreadable as JSON.
/// - `Err(())` when `rest` attempts path traversal (`..` present, or
///   canonicalization escapes the quizzes root). The caller maps it to
///   `"403|..."`.
///
/// `rest` is the path relative to `<topic>/quizzes/`, e.g. `"promise/quiz-2026-06-23-080000.json"`
/// (the suffix of the flat path stored in `TopicData.files.quizzes`).
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
        )
        .unwrap();
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
        let v = read_quiz_deck("js", "nope/missing.json", root.path());
        assert_eq!(v, Ok(None));
    }
}