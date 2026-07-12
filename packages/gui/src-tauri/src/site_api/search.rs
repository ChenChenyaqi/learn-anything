//! Search index builder — the flattest form of the learning tree, ported
//! from `serve.mjs::buildSearchIndex`. Scans `.md` files at topic root or
//! exactly one subdir deep across `sessions/`, `knowledge-map.md`, `exercises/`,
//! extracting ATX headings (skipping fenced code blocks) and emitting one
//! `level=0` filename pseudo-entry plus a `level=N` heading entry per heading.
//!
//! A cached copy is held in a process-wide `Mutex` keyed by the topics_dir
//! path, so repeated `site_search_index` calls don't rescan the filesystem;
//! the watcher invalidates the cache on every change event (and changing the
//! working folder naturally invalidates because the key path differs).

use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use regex::Regex;

use super::model::{SearchEntry, StateV1};
use super::topics::{list_dir_names, read_json, read_text};

/// `^#{1,6}\s+(.+)$` ATX heading opener (compiled once via `LazyLock`).
/// Matches whole-line — `Regex` is anchored on the rope of one line at a time
/// (we iterate line-by-line, so `^`/`$` match line boundaries naturally
/// without needing the `m` flag).
static HEADING: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(#{1,6})\s+(.+)$").unwrap());
/// Opening fence marker — runs of 3+ backticks or tildes at line start
/// (after optional leading whitespace), like `serve.mjs`'s
/// `/^\s*(`{3,}|~{3,})/`.
static FENCE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*(`{3,}|~{3,})").unwrap());

/// Cache: `(topics_dir, index)`. Swapping working folders invalidates via
/// key mismatch in `get_or_build`; the watcher calls `invalidate()` to bump
/// the version too (see `watcher.rs`).
static SEARCH_CACHE: Mutex<Option<(PathBuf, Vec<SearchEntry>)>> = Mutex::new(None);

/// Filename-only pseudo-entry + one entry per heading inside that file.
///
/// `level == 0` is reserved for the filename row (so users can search by
/// file name), `level >= 1` are real headings.
fn build_file_entries(
    fs_path: &Path,
    api_path: &str,
    topic_slug: &str,
    topic_name: &str,
    section: &str,
    kind: &str,
) -> Vec<SearchEntry> {
    let mut out = Vec::new();
    // base name without `.md`
    let base_name = fs_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    out.push(SearchEntry {
        title: base_name,
        level: 0,
        path: api_path.to_string(),
        topic_slug: topic_slug.to_string(),
        topic_name: topic_name.to_string(),
        section: section.to_string(),
        kind: kind.to_string(),
    });
    if let Some(content) = read_text(fs_path) {
        for (title, level) in extract_headings(&content) {
            out.push(SearchEntry {
                title,
                level,
                path: api_path.to_string(),
                topic_slug: topic_slug.to_string(),
                topic_name: topic_name.to_string(),
                section: section.to_string(),
                kind: kind.to_string(),
            });
        }
    }
    out
}

/// Extract ATX headings `#`–`######`, skipping lines inside fenced code blocks
/// (```` ``` ```` or `~~~`). Trailing `#`s are stripped and the title trimmed.
/// Matches `serve.mjs::extractHeadings` byte-for-byte.
fn extract_headings(content: &str) -> Vec<(String, u32)> {
    let mut out = Vec::new();
    let mut in_fence = false;
    for line in content.lines() {
        if FENCE.is_match(line) {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        let Some(caps) = HEADING.captures(line) else {
            continue;
        };
        let level = caps[1].len() as u32;
        let raw = &caps[2];
        // strip trailing #s and whitespace
        let trimmed = raw.trim_end_matches('#').trim();
        if !trimmed.is_empty() {
            out.push((trimmed.to_string(), level));
        }
    }
    out
}

/// Collect `.md` files at root of `dir` or exactly one subdir deep —
/// matching the site sidebar's two-level (deeper nesting isn't displayed).
/// Returns relative paths (`name.md` or `subdir/name.md`).
fn collect_markdown_files(dir: &Path) -> Vec<String> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return out;
    };
    for entry in entries.flatten() {
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let name_os = entry.file_name();
        let Some(name) = name_os.to_str() else { continue };
        if is_dir {
            let sub = dir.join(name);
            if let Ok(files) = std::fs::read_dir(&sub) {
                for f in files.flatten() {
                    let is_file = f.file_type().map(|t| t.is_file()).unwrap_or(false);
                    let fname_os = f.file_name();
                    let Some(fname) = fname_os.to_str() else { continue };
                    if is_file && fname.ends_with(".md") {
                        out.push(format!("{name}/{fname}"));
                    }
                }
            }
        } else if name.ends_with(".md") {
            out.push(name.to_string());
        }
    }
    out
}

/// Build the full flat index across all topics.
pub(super) fn build_search_index(topics_dir: &Path) -> Vec<SearchEntry> {
    let mut index = Vec::new();
    for slug in list_dir_names(topics_dir) {
        let topic_dir = topics_dir.join(&slug);
        if !topic_dir.is_dir() {
            continue;
        }
        let state: StateV1 = read_json(&topic_dir.join("state.json")).unwrap_or_default();
        let topic_name = if state.topic.is_empty() { slug.clone() } else { state.topic.clone() };
        let slug_name = build_slug_name_map(&state);

        // sessions/**/*.md
        let sessions_dir = topic_dir.join("sessions");
        for rel in collect_markdown_files(&sessions_dir) {
            let dir_name = rel.split_once('/').map(|(d, _)| d).unwrap_or("");
            let section = if dir_name.is_empty() {
                topic_name.clone()
            } else {
                slug_name.get(dir_name).cloned().unwrap_or_else(|| dir_name.to_string())
            };
            index.extend(build_file_entries(
                &sessions_dir.join(&rel),
                &format!("/topics/{slug}/sessions/{rel}"),
                &slug,
                &topic_name,
                &section,
                "note",
            ));
        }

        // knowledge-map.md
        let km_path = topic_dir.join("knowledge-map.md");
        if km_path.exists() {
            index.extend(build_file_entries(
                &km_path,
                &format!("/topics/{slug}/knowledge-map.md"),
                &slug,
                &topic_name,
                "Knowledge Map",
                "knowledge-map",
            ));
        }

        // exercises/**/*.md
        let exercises_dir = topic_dir.join("exercises");
        for rel in collect_markdown_files(&exercises_dir) {
            let dir_name = rel.split_once('/').map(|(d, _)| d).unwrap_or("");
            let section = if dir_name.is_empty() {
                topic_name.clone()
            } else {
                slug_name.get(dir_name).cloned().unwrap_or_else(|| dir_name.to_string())
            };
            index.extend(build_file_entries(
                &exercises_dir.join(&rel),
                &format!("/topics/{slug}/exercises/{rel}"),
                &slug,
                &topic_name,
                &section,
                "exercise",
            ));
        }
    }
    index
}

/// Map both domain and concept slugs → display names (used by search to label
/// the `section` for a `sessions/<dir>/...` file).
fn build_slug_name_map(state: &StateV1) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    for domain in &state.domains {
        map.insert(domain.slug.clone(), domain.name.clone());
        for concept in &domain.concepts {
            map.insert(concept.slug.clone(), concept.name.clone());
        }
    }
    map
}

/// Return the cached index for `topics_dir`, building it on first access.
/// If the working folder changed (key mismatch), the old cache is discarded
/// and a fresh one is built (the watcher doesn't need to know the new folder
/// in advance for this invalidation to work — it just invalidates on
/// filesystem events; folder switches invalidate by key alone).
pub(super) fn get_or_build(topics_dir: &Path) -> Vec<SearchEntry> {
    let mut guard = SEARCH_CACHE.lock().expect("search cache poisoned");
    if let Some((cached_dir, index)) = guard.as_ref() {
        if cached_dir == topics_dir {
            return index.clone();
        }
    }
    let index = build_search_index(topics_dir);
    *guard = Some((topics_dir.to_path_buf(), index.clone()));
    index
}

/// Invalidate any cached index. Called by the file watcher on every change
/// event.
pub(super) fn invalidate() {
    let mut guard = SEARCH_CACHE.lock().expect("search cache poisoned");
    *guard = None;
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
    fn extract_headings_basic_levels() {
        let md = "# A\n## B\n### C\nText\n#### D\n";
        let h: Vec<_> = extract_headings(md).into_iter().collect();
        assert_eq!(
            h,
            vec![
                ("A".to_string(), 1),
                ("B".to_string(), 2),
                ("C".to_string(), 3),
                ("D".to_string(), 4),
            ]
        );
    }

    #[test]
    fn extract_headings_strips_trailing_hashes() {
        let h = extract_headings("## Title ##");
        assert_eq!(h, vec![("Title".to_string(), 2)]);
    }

    #[test]
    fn extract_headings_skips_fenced_blocks() {
        let md = "# Real\n```\n# Not a heading\n## Also not\n```\n## Outside\n";
        let h = extract_headings(md);
        assert_eq!(
            h.into_iter().map(|(t, _)| t).collect::<Vec<_>>(),
            vec!["Real".to_string(), "Outside".to_string()]
        );
    }

    #[test]
    fn extract_headings_respects_tilde_fences() {
        let md = "# Real\n~~~\n# Fake\n~~~\n## Real2\n";
        let h = extract_headings(md);
        assert_eq!(h.len(), 2);
        assert_eq!(h[0].0, "Real");
        assert_eq!(h[1].0, "Real2");
    }

    #[test]
    fn collect_markdown_files_root_and_one_deep() {
        let root = tempdir().unwrap();
        let dir = root.path().join("d");
        fs::create_dir_all(dir.join("sub")).unwrap();
        fs::write(dir.join("root.md"), "").unwrap();
        fs::write(dir.join("sub").join("child.md"), "").unwrap();
        // Two-deep should be ignored.
        fs::create_dir_all(dir.join("sub").join("deeper")).unwrap();
        fs::write(dir.join("sub").join("deeper").join("x.md"), "").unwrap();
        let mut files = collect_markdown_files(&dir);
        files.sort();
        assert_eq!(files, vec!["root.md", "sub/child.md"]);
    }

    #[test]
    fn search_index_over_topic_dir() {
        let root = tempdir().unwrap();
        let topic = root.path().join("js");
        fs::create_dir_all(topic.join("sessions").join("language-basics")).unwrap();
        fs::write(
            topic.join("sessions").join("language-basics").join("notes.md"),
            "# Heading\nbody\n## Sub\n",
        ).unwrap();
        fs::write(topic.join("knowledge-map.md"), "# Knowledge Map\n").unwrap();
        write_state(
            &topic,
            r#"{"topic":"JS","domains":[
               {"name":"Lang","slug":"language-basics","concepts":[]}]}"#,
        );
        let idx = build_search_index(root.path());
        // Should have: notes.md (level 0), Heading (1), Sub (2), knowledge-map (0), "Knowledge Map" (1)
        let mut levels: Vec<_> = idx.iter().map(|e| (e.kind.clone(), e.level, e.title.clone())).collect();
        levels.sort();
        assert!(levels.iter().any(|(_, _, t)| t == "notes"));
        assert!(levels.iter().any(|(_, _, t)| t == "Heading"));
        assert!(levels.iter().any(|(_, _, t)| t == "Sub"));
        assert!(levels.iter().any(|(_, _, t)| t == "knowledge-map"));
        assert!(levels.iter().any(|(_, _, t)| t == "Knowledge Map"));
        // section for sub files maps domain slug → domain name like `serve.mjs`.
        let notes_row = idx.iter().find(|e| e.title == "notes").unwrap();
        assert_eq!(notes_row.section, "Lang");
    }

    #[test]
    fn cache_invalidates_on_filesystem_path_change() {
        let a = tempdir().unwrap();
        let b = tempdir().unwrap();
        let a_topic = a.path().join("js");
        fs::create_dir_all(&a_topic).unwrap();
        // Need at least one .md file so the index isn't empty.
        fs::write(a_topic.join("knowledge-map.md"), "# A").unwrap();
        write_state(&a_topic, r#"{"topic":"JS"}"#);
        let v1 = get_or_build(a.path());
        assert!(!v1.is_empty());
        // Different dir → cache key mismatch → rebuild from b (empty).
        let v2 = get_or_build(b.path());
        assert!(v2.is_empty());
        // Going back to a re-reads from disk (not stale cached).
        invalidate();
        let v1b = get_or_build(a.path());
        assert_eq!(v1.len(), v1b.len());
    }
}