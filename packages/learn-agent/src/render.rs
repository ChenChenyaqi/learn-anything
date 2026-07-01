//! Knowledge-map markdown rendering — a pure `StateV1` → `String` port of
//! `packages/cli/src/scripts/render.mts`. Reimplemented in Rust so the desktop
//! binary can generate `knowledge-map.md` without a Node runtime on the host.

use crate::state::{mastered_count, total_count, ConceptStatus, StateV1};

/// Escape underscores in text destined for Markdown output (mirrors `esc`).
///
/// Intentionally only escapes `_` to stay byte-for-byte aligned with the CLI's
/// `render.mts`. Other Markdown metacharacters (`*`, `` ` ``, `#`, `[`, …) are
/// left as-is; widening the escape set here would diverge from the CLI output.
fn esc(s: &str) -> String {
    s.replace('_', "\\_")
}

/// Render a [`StateV1`] into the `knowledge-map.md` markdown: topic title,
/// mastered/total progress header, then per-domain sections with concept bullets
/// (status icon + label) and nested detail lines.
pub fn render(state: &StateV1) -> String {
    let mut lines: Vec<String> = Vec::new();

    // Title.
    lines.push(format!("# {}", esc(&state.topic)));
    lines.push(String::new());

    // Progress header.
    let total = total_count(state);
    let mastered = mastered_count(state);
    let pct = if total > 0 {
        (mastered as f64 / total as f64 * 100.0).round() as i64
    } else {
        0
    };
    lines.push(format!("> {mastered}/{total} mastered · {pct}% complete"));
    lines.push(String::new());

    // Domains → concepts → details.
    for domain in &state.domains {
        lines.push(format!("## {}", esc(&domain.name)));
        lines.push(String::new());
        for concept in &domain.concepts {
            lines.push(format!(
                "- {} **{}** ({})",
                ConceptStatus::icon(concept.status),
                esc(&concept.name),
                ConceptStatus::label(concept.status)
            ));
            for detail in &concept.details {
                lines.push(format!("  - {}", esc(detail)));
            }
        }
        if !domain.concepts.is_empty() {
            lines.push(String::new());
        }
    }

    let joined = lines.join("\n");
    format!("{}\n", joined.trim_end())
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_fixture_like_cli() {
        let json = include_str!("../mock/state.json");
        let state: StateV1 = serde_json::from_str(json).unwrap();
        let rendered = render(&state);
        let expected = include_str!("../mock/knowledge-map.md");
        assert_eq!(rendered, expected);
    }

    #[test]
    fn is_idempotent() {
        let json = include_str!("../mock/state.json");
        let state: StateV1 = serde_json::from_str(json).unwrap();
        assert_eq!(render(&state), render(&state));
    }

    #[test]
    fn escapes_underscores() {
        let state = StateV1 {
            version: 1,
            topic: "a_b".into(),
            slug: "a_b".into(),
            created: "2026-01-01".into(),
            domains: vec![crate::state::Domain {
                name: "d_e".into(),
                slug: "d_e".into(),
                concepts: vec![crate::state::Concept {
                    name: "c_f".into(),
                    slug: "c_f".into(),
                    status: ConceptStatus::Unexplored,
                    confidence: 0.0,
                    practice_count: 0,
                    explain_count: 0,
                    last_explained: None,
                    last_practiced: None,
                    details: vec!["node_modules".into()],
                }],
            }],
        };
        let out = render(&state);
        assert!(out.contains("# a\\_b"), "{out}");
        assert!(out.contains("## d\\_e"), "{out}");
        assert!(out.contains("**c\\_f**"), "{out}");
        assert!(out.contains("node\\_modules"), "{out}");
    }

    #[test]
    fn empty_state_renders_header() {
        let state = StateV1 {
            version: 1,
            topic: "Empty".into(),
            slug: "empty".into(),
            created: "2026-01-01".into(),
            domains: vec![],
        };
        let out = render(&state);
        assert_eq!(out, "# Empty\n\n> 0/0 mastered · 0% complete\n");
    }
}
