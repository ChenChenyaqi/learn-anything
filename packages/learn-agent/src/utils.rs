//! Generic JSON value-validation primitives shared across schemas.
//!
//! These mirror the per-field `Checker` factories (`literal`, `str`, `num`,
//! `dateStr`, `nullable`, `arr`, `oneOf`) and the `checkFields` driver from the
//! CLI's `utils.mts`. They are deliberately decoupled from any specific schema
//! (`StateV1` now, `QuizDeck` later) so each validator can reuse them.

use serde_json::Value;

/// A single field-level validation failure: a dotted `path` plus a human-facing
/// `message`. Mirrors the CLI's `{ path, message }`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError {
    pub path: String,
    pub message: String,
}

/// Result of a single field check: `None` means valid, `Some(message)` is the
/// first validation error found for that value.
pub type Check = Option<String>;

/* ------------------------------------------------------------------ */
/*  Per-value checkers                                                */
/* ------------------------------------------------------------------ */
// Each takes `Option<&Value>` so "missing" vs "present null" can be told
// apart, exactly like the TS `undefined`/`null` distinction.

pub fn literal_check(opt: Option<&Value>, expected: &Value) -> Check {
    match opt {
        Some(v) if v == expected => None,
        _ => Some(format!("Must be {expected}")),
    }
}

pub fn str_check(opt: Option<&Value>) -> Check {
    match opt {
        Some(Value::String(s)) if !s.is_empty() => None,
        _ => Some("Must be a non-empty string".into()),
    }
}

pub fn array_check(opt: Option<&Value>) -> Check {
    match opt {
        Some(Value::Array(_)) => None,
        _ => Some("Must be an array".into()),
    }
}

pub fn one_of_check(opt: Option<&Value>, allowed: &[&str]) -> Check {
    match opt.and_then(Value::as_str) {
        Some(s) if allowed.contains(&s) => None,
        _ => Some(format!("Must be one of: {}", allowed.join(", "))),
    }
}

pub fn date_check(opt: Option<&Value>) -> Check {
    match opt.and_then(Value::as_str) {
        Some(s) if is_date_str(s) => None,
        _ => Some("Must match YYYY-MM-DD or YYYY-MM-DD HH:mm:ss".into()),
    }
}

/// `null` is allowed; missing is not; otherwise must be a valid date.
pub fn nullable_date_check(opt: Option<&Value>) -> Check {
    match opt {
        None => Some("Must match YYYY-MM-DD or YYYY-MM-DD HH:mm:ss".into()),
        Some(Value::Null) => None,
        Some(v) => date_check(Some(v)),
    }
}

pub fn num_check(opt: Option<&Value>, min: Option<f64>, max: Option<f64>, int: bool) -> Check {
    let f = match opt
        .and_then(Value::as_number)
        .and_then(serde_json::Number::as_f64)
    {
        Some(f) => f,
        None => return Some("Must be a number".into()),
    };
    if let Some(mn) = min {
        if f < mn {
            return Some(format!("Must be >= {mn}"));
        }
    }
    if let Some(mx) = max {
        if f > mx {
            return Some(format!("Must be <= {mx}"));
        }
    }
    if int && f.fract() != 0.0 {
        return Some("Must be an integer".into());
    }
    None
}

pub fn str_array_check(opt: Option<&Value>) -> Check {
    let arr = match opt {
        Some(Value::Array(a)) => a,
        _ => return Some("Must be an array".into()),
    };
    for item in arr {
        if let Some(msg) = str_check(Some(item)) {
            return Some(msg);
        }
    }
    None
}

/* ------------------------------------------------------------------ */
/*  Driver                                                            */
/* ------------------------------------------------------------------ */

/// Runs a checker against one field of an object and pushes a path-qualified
/// [`ValidationError`] on failure. `prefix` is the containing path (e.g.
/// `domains[0].concepts[1]`) so errors read like `domains[0].concepts[1].slug`.
pub fn check_field(
    obj: &Value,
    key: &str,
    prefix: &str,
    errors: &mut Vec<ValidationError>,
    checker: impl Fn(Option<&Value>) -> Check,
) {
    if let Some(message) = checker(obj.get(key)) {
        let path = if prefix.is_empty() {
            key.to_string()
        } else {
            format!("{prefix}.{key}")
        };
        errors.push(ValidationError { path, message });
    }
}

/* ------------------------------------------------------------------ */
/*  Date shape helpers                                                */
/* ------------------------------------------------------------------ */
// Mirrors the CLI regex `^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$` (ASCII
// digits only) without pulling in a regex dependency. Only the *shape* is
// validated, not calendar validity (e.g. `"2026-13-45"` passes), to match the
// CLI's regex-only behavior exactly.
fn is_date_str(s: &str) -> bool {
    let (date, time) = match s.split_once(' ') {
        Some((d, t)) => (d, Some(t)),
        None => (s, None),
    };
    is_yyyy_mm_dd(date) && time.is_none_or(is_hh_mm_ss)
}

fn is_yyyy_mm_dd(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b[0..4].iter().all(u8::is_ascii_digit)
        && b[5..7].iter().all(u8::is_ascii_digit)
        && b[8..10].iter().all(u8::is_ascii_digit)
}

fn is_hh_mm_ss(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 8
        && b[2] == b':'
        && b[5] == b':'
        && b[0..2].iter().all(u8::is_ascii_digit)
        && b[3..5].iter().all(u8::is_ascii_digit)
        && b[6..8].iter().all(u8::is_ascii_digit)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn date_shape() {
        assert!(is_date_str("2026-06-11"));
        assert!(is_date_str("2026-06-11 10:30:00"));
        assert!(!is_date_str("06/11/2026"));
        assert!(!is_date_str("2026-6-11"));
        assert!(!is_date_str("2026-06-11 10:30"));
    }

    #[test]
    fn str_check_missing_vs_empty() {
        assert!(str_check(None).is_some());
        assert!(str_check(Some(&json!(""))).is_some());
        assert!(str_check(Some(&json!("x"))).is_none());
    }

    #[test]
    fn num_check_range_and_int() {
        assert!(num_check(Some(&json!(0.5)), Some(0.0), Some(1.0), false).is_none());
        assert!(num_check(Some(&json!(1.5)), Some(0.0), Some(1.0), false)
            .unwrap()
            .contains("<= 1"));
        assert!(num_check(Some(&json!(1.5)), Some(0.0), None, true)
            .unwrap()
            .contains("integer"));
        assert_eq!(
            num_check(Some(&json!("x")), None, None, false).as_deref(),
            Some("Must be a number")
        );
    }

    #[test]
    fn nullable_date_distinguishes_null_and_missing() {
        assert!(nullable_date_check(Some(&Value::Null)).is_none());
        assert!(nullable_date_check(None).is_some());
    }

    #[test]
    fn check_field_prefixes_path() {
        let mut errors = Vec::new();
        let obj = json!({"a": ""});
        check_field(&obj, "a", "domains[0]", &mut errors, str_check);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].path, "domains[0].a");
    }
}
