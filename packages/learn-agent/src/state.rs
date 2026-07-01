//! v1 data types, schema-specific validator, and counting helpers.
//!
//! Mirrors `packages/cli/src/scripts/utils.mts` (`StateV1`, `Domain`, `Concept`,
//! the `ConceptStatus` enum, and `validateStateV1`) so the GUI/agent share the
//! exact same `.learn/` v1 data contract as the CLI.
//!
//! The reusable value-checking primitives live in [`crate::utils`].

use crate::utils::{
    array_check, check_field, date_check, literal_check, nullable_date_check, num_check,
    one_of_check, str_array_check, str_check, ValidationError,
};
use serde_json::Value;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/// A concept's learning status. Serializes as the snake_case strings used
/// throughout the v1 contract: `unexplored`, `in_progress`, `needs_practice`,
/// `mastered`.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema,
)]
#[serde(rename_all = "snake_case")]
#[schemars(rename_all = "snake_case")]
pub enum ConceptStatus {
    Unexplored,
    InProgress,
    NeedsPractice,
    Mastered,
}

impl ConceptStatus {
    /// Emoji icon used in the rendered knowledge map.
    pub fn icon(self) -> &'static str {
        match self {
            ConceptStatus::Mastered => "🟢",
            ConceptStatus::InProgress => "🔵",
            ConceptStatus::NeedsPractice => "🟠",
            ConceptStatus::Unexplored => "⚪",
        }
    }

    /// Human-readable label used in the rendered knowledge map.
    pub fn label(self) -> &'static str {
        match self {
            ConceptStatus::Mastered => "mastered",
            ConceptStatus::InProgress => "in progress",
            ConceptStatus::NeedsPractice => "needs practice",
            ConceptStatus::Unexplored => "unexplored",
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub struct Concept {
    pub name: String,
    pub slug: String,
    pub status: ConceptStatus,
    /// Inclusive range `[0.0, 1.0]`.
    pub confidence: f64,
    pub practice_count: u64,
    pub explain_count: u64,
    pub last_explained: Option<String>,
    pub last_practiced: Option<String>,
    pub details: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub struct Domain {
    pub name: String,
    pub slug: String,
    pub concepts: Vec<Concept>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
pub struct StateV1 {
    /// Must be `1`.
    pub version: u8,
    pub topic: String,
    pub slug: String,
    pub created: String,
    pub domains: Vec<Domain>,
}

/* ------------------------------------------------------------------ */
/*  Counting helpers                                                  */
/* ------------------------------------------------------------------ */

/// Total number of concepts across all domains.
pub fn total_count(state: &StateV1) -> usize {
    state.domains.iter().map(|d| d.concepts.len()).sum()
}

/// Number of concepts whose status is `mastered`.
pub fn mastered_count(state: &StateV1) -> usize {
    state
        .domains
        .iter()
        .flat_map(|d| d.concepts.iter())
        .filter(|c| c.status == ConceptStatus::Mastered)
        .count()
}

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

/// Validates a raw JSON value against the v1 `StateV1` schema, returning every
/// field-level failure found (empty slice == valid). This is a faithful port of
/// `validateStateV1` from `utils.mts`: it operates on the untyped value so it
/// can report precise `domains[i].concepts[j].<field>` paths before any
/// deserialization. The per-field checks come from [`crate::utils`].
pub fn validate_state(value: &Value) -> Vec<ValidationError> {
    let mut errors = Vec::new();

    let obj = match value {
        Value::Object(_) => value,
        _ => {
            errors.push(ValidationError {
                path: String::new(),
                message: "Expected a non-null object".into(),
            });
            return errors;
        }
    };

    // State-level fields.
    // Note: `serde_json::Number` distinguishes integer from float, so a literal
    // `1.0` is rejected here ("Must be 1") whereas the TS CLI's `=== 1` accepts
    // it. This divergence never surfaces on the typed path (`StateV1.version`
    // is `u8`, which round-trips to an integer); it can only appear when
    // `validate_state` is called directly on raw JSON.
    check_field(obj, "version", "", &mut errors, |v| {
        literal_check(v, &serde_json::json!(1))
    });
    check_field(obj, "topic", "", &mut errors, str_check);
    check_field(obj, "slug", "", &mut errors, str_check);
    check_field(obj, "created", "", &mut errors, date_check);
    check_field(obj, "domains", "", &mut errors, array_check);

    if let Some(domains) = obj.get("domains").and_then(|v| v.as_array()) {
        for (di, domain) in domains.iter().enumerate() {
            let dp = format!("domains[{di}]");
            check_field(domain, "name", &dp, &mut errors, str_check);
            check_field(domain, "slug", &dp, &mut errors, str_check);
            check_field(domain, "concepts", &dp, &mut errors, array_check);

            if let Some(concepts) = domain.get("concepts").and_then(|v| v.as_array()) {
                for (ci, concept) in concepts.iter().enumerate() {
                    let cp = format!("{dp}.concepts[{ci}]");
                    check_field(concept, "name", &cp, &mut errors, str_check);
                    check_field(concept, "slug", &cp, &mut errors, str_check);
                    check_field(concept, "status", &cp, &mut errors, |v| {
                        one_of_check(v, STATUS_VALUES)
                    });
                    check_field(concept, "confidence", &cp, &mut errors, |v| {
                        num_check(v, Some(0.0), Some(1.0), false)
                    });
                    check_field(concept, "practice_count", &cp, &mut errors, |v| {
                        num_check(v, Some(0.0), None, true)
                    });
                    check_field(concept, "explain_count", &cp, &mut errors, |v| {
                        num_check(v, Some(0.0), None, true)
                    });
                    check_field(
                        concept,
                        "last_explained",
                        &cp,
                        &mut errors,
                        nullable_date_check,
                    );
                    check_field(
                        concept,
                        "last_practiced",
                        &cp,
                        &mut errors,
                        nullable_date_check,
                    );
                    check_field(concept, "details", &cp, &mut errors, str_array_check);
                }
            }
        }
    }

    errors
}

const STATUS_VALUES: &[&str] = &["unexplored", "in_progress", "needs_practice", "mastered"];

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn valid_concept() -> Value {
        json!({
            "name": "Closures",
            "slug": "closures",
            "status": "in_progress",
            "confidence": 0.5,
            "practice_count": 3,
            "explain_count": 1,
            "last_explained": "2026-06-11 10:30:00",
            "last_practiced": null,
            "details": ["lexical scope", "closure traps"]
        })
    }

    fn valid_state() -> Value {
        json!({
            "version": 1,
            "topic": "JavaScript",
            "slug": "javascript",
            "created": "2026-06-11",
            "domains": [
                { "name": "Basics", "slug": "basics", "concepts": [valid_concept()] }
            ]
        })
    }

    fn assert_invalid(v: &Value, path: &str, contains: &str) {
        let errors = validate_state(v);
        let e = errors
            .iter()
            .find(|e| e.path == path)
            .unwrap_or_else(|| panic!("no error at path {path:?}; errors = {errors:?}"));
        assert!(
            e.message.contains(contains),
            "at {path:?}: message {:?} should contain {contains:?}",
            e.message
        );
    }

    #[test]
    fn accepts_valid_state() {
        assert!(validate_state(&valid_state()).is_empty());
    }

    #[test]
    fn accepts_mock_fixture() {
        let fixture = include_str!("../mock/state.json");
        let value: Value = serde_json::from_str(fixture).unwrap();
        assert!(
            validate_state(&value).is_empty(),
            "fixture should be valid v1"
        );
    }

    #[test]
    fn rejects_non_object() {
        let errors = validate_state(&json!([1, 2, 3]));
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message, "Expected a non-null object");
    }

    #[test]
    fn rejects_null() {
        let errors = validate_state(&Value::Null);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message, "Expected a non-null object");
    }

    #[test]
    fn rejects_wrong_version() {
        let mut v = valid_state();
        *v.get_mut("version").unwrap() = json!(2);
        assert_invalid(&v, "version", "Must be 1");
    }

    #[test]
    fn rejects_missing_version() {
        let mut v = valid_state();
        v.as_object_mut().unwrap().remove("version");
        assert_invalid(&v, "version", "Must be 1");
    }

    #[test]
    fn rejects_empty_topic() {
        let mut v = valid_state();
        *v.get_mut("topic").unwrap() = json!("");
        assert_invalid(&v, "topic", "non-empty");
    }

    #[test]
    fn rejects_bad_date_format() {
        let mut v = valid_state();
        *v.get_mut("created").unwrap() = json!("06/11/2026");
        assert_invalid(&v, "created", "YYYY-MM-DD");
    }

    #[test]
    fn accepts_datetime_with_time() {
        let mut v = valid_state();
        *v.get_mut("created").unwrap() = json!("2026-06-11 10:30:00");
        assert!(validate_state(&v).is_empty());
    }

    #[test]
    fn rejects_confidence_out_of_range() {
        let mut v = valid_state();
        *v.get_mut("domains").unwrap()[0]
            .get_mut("concepts")
            .unwrap()[0]
            .get_mut("confidence")
            .unwrap() = json!(1.5);
        assert_invalid(&v, "domains[0].concepts[0].confidence", "Must be <= 1");
    }

    #[test]
    fn rejects_negative_count() {
        let mut v = valid_state();
        *v.get_mut("domains").unwrap()[0]
            .get_mut("concepts")
            .unwrap()[0]
            .get_mut("practice_count")
            .unwrap() = json!(-1);
        // -1 is a JSON number, so the range check fires (mirrors TS `num`).
        assert_invalid(&v, "domains[0].concepts[0].practice_count", "Must be >= 0");
    }

    #[test]
    fn rejects_non_integer_count() {
        let mut v = valid_state();
        *v.get_mut("domains").unwrap()[0]
            .get_mut("concepts")
            .unwrap()[0]
            .get_mut("explain_count")
            .unwrap() = json!(1.5);
        assert_invalid(
            &v,
            "domains[0].concepts[0].explain_count",
            "Must be an integer",
        );
    }

    #[test]
    fn rejects_bad_status() {
        let mut v = valid_state();
        *v.get_mut("domains").unwrap()[0]
            .get_mut("concepts")
            .unwrap()[0]
            .get_mut("status")
            .unwrap() = json!("done");
        assert_invalid(&v, "domains[0].concepts[0].status", "Must be one of");
    }

    #[test]
    fn rejects_nullable_date_when_missing() {
        let mut v = valid_state();
        v.get_mut("domains").unwrap()[0]
            .get_mut("concepts")
            .unwrap()[0]
            .as_object_mut()
            .unwrap()
            .remove("last_explained");
        assert_invalid(&v, "domains[0].concepts[0].last_explained", "YYYY-MM-DD");
    }

    #[test]
    fn rejects_details_not_array() {
        let mut v = valid_state();
        *v.get_mut("domains").unwrap()[0]
            .get_mut("concepts")
            .unwrap()[0]
            .get_mut("details")
            .unwrap() = json!("not an array");
        assert_invalid(&v, "domains[0].concepts[0].details", "Must be an array");
    }

    #[test]
    fn rejects_empty_detail_string() {
        let mut v = valid_state();
        *v.get_mut("domains").unwrap()[0]
            .get_mut("concepts")
            .unwrap()[0]
            .get_mut("details")
            .unwrap() = json!(["ok", ""]);
        assert_invalid(&v, "domains[0].concepts[0].details", "non-empty");
    }

    #[test]
    fn counts_work() {
        let fixture = include_str!("../mock/state.json");
        let state: StateV1 = serde_json::from_str(fixture).unwrap();
        assert_eq!(total_count(&state), 5);
        assert_eq!(mastered_count(&state), 2);
    }

    #[test]
    fn status_round_trips_as_snake_case() {
        for s in [
            ConceptStatus::Unexplored,
            ConceptStatus::InProgress,
            ConceptStatus::NeedsPractice,
            ConceptStatus::Mastered,
        ] {
            let json = serde_json::to_string(&s).unwrap();
            let back: ConceptStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(s, back);
        }
        assert_eq!(
            serde_json::to_string(&ConceptStatus::InProgress).unwrap(),
            "\"in_progress\""
        );
    }
}
