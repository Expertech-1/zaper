//! Vocabulary shared across the domain: modes, answer lengths, ids, timestamps.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// The three product modes from the specification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum Mode {
    /// General knowledge and research questions.
    #[default]
    Research,
    /// Job / behavioral interview answers grounded in the active profile.
    Job,
    /// Technical and coding interview questions.
    Coding,
}

impl Mode {
    /// Value stored in SQLite (must match the `CHECK` constraints in the schema).
    #[allow(dead_code, reason = "written by the interviews/conversations repositories in M2")]
    pub fn as_str(self) -> &'static str {
        match self {
            Mode::Research => "research",
            Mode::Job => "job",
            Mode::Coding => "coding",
        }
    }

    /// Parses a value read back from SQLite or supplied over IPC.
    #[allow(dead_code, reason = "read by the interviews/conversations repositories in M2")]
    pub fn parse(value: &str) -> AppResult<Self> {
        match value {
            "research" => Ok(Mode::Research),
            "job" => Ok(Mode::Job),
            "coding" => Ok(Mode::Coding),
            other => Err(AppError::validation(format!(
                "'{other}' is not a valid mode. Expected research, job or coding."
            ))),
        }
    }
}

/// How long generated answers should be. This is a *generation* parameter, not
/// a UI label — it feeds the prompt and the token budget (spec §17).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum AnswerLength {
    /// 1–3 concise sentences.
    Short,
    /// A conversational answer with useful detail.
    #[default]
    Medium,
    /// Deeper explanation with examples and tradeoffs.
    Detailed,
}

impl AnswerLength {
    #[allow(dead_code, reason = "written by the conversations repository in M2")]
    pub fn as_str(self) -> &'static str {
        match self {
            AnswerLength::Short => "short",
            AnswerLength::Medium => "medium",
            AnswerLength::Detailed => "detailed",
        }
    }

    #[allow(dead_code, reason = "read by the conversations repository in M2")]
    pub fn parse(value: &str) -> AppResult<Self> {
        match value {
            "short" => Ok(AnswerLength::Short),
            "medium" => Ok(AnswerLength::Medium),
            "detailed" => Ok(AnswerLength::Detailed),
            other => Err(AppError::validation(format!(
                "'{other}' is not a valid answer length. Expected short, medium or detailed."
            ))),
        }
    }

    /// Soft output-token budget for this length. Used by the LLM adapters (M2)
    /// so the setting has real effect instead of only appearing in the prompt.
    pub fn max_output_tokens(self) -> u32 {
        match self {
            AnswerLength::Short => 160,
            AnswerLength::Medium => 500,
            AnswerLength::Detailed => 1_200,
        }
    }
}

/// UI colour scheme preference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    Light,
    Dark,
    /// Follow the desktop's `prefers-color-scheme`.
    #[default]
    System,
}

/// Generates a new opaque entity id.
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Current UTC instant as an RFC 3339 string — the timestamp format used by
/// every `*_at` column. Sorts lexicographically, round-trips through JSON.
pub fn now_timestamp() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// Trims a required text field and rejects it when empty or over `max_len`.
pub fn require_text(field: &'static str, value: &str, max_len: usize) -> AppResult<String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(AppError::validation(format!("{field} cannot be empty.")));
    }

    if trimmed.chars().count() > max_len {
        return Err(AppError::validation(format!(
            "{field} is too long (maximum {max_len} characters)."
        )));
    }

    Ok(trimmed.to_string())
}

/// Trims an optional text field, mapping blank input to `None` so the database
/// never holds a mix of `NULL` and `""` for "no value".
pub fn optional_text(value: Option<String>, max_len: usize) -> AppResult<Option<String>> {
    match value {
        None => Ok(None),
        Some(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            if trimmed.chars().count() > max_len {
                return Err(AppError::validation(format!(
                    "This field is too long (maximum {max_len} characters)."
                )));
            }
            Ok(Some(trimmed.to_string()))
        }
    }
}

/// Normalizes a list of short tags: trims, drops blanks, removes
/// case-insensitive duplicates, preserves the caller's ordering, and caps the
/// total count so a paste accident cannot bloat every future prompt.
pub fn normalize_tags(values: Vec<String>, max_items: usize) -> AppResult<Vec<String>> {
    let mut seen: Vec<String> = Vec::new();
    let mut out: Vec<String> = Vec::new();

    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }

        let key = trimmed.to_lowercase();
        if seen.contains(&key) {
            continue;
        }

        seen.push(key);
        out.push(trimmed.to_string());
    }

    if out.len() > max_items {
        return Err(AppError::validation(format!("Please keep this list to {max_items} entries.")));
    }

    Ok(out)
}

/// Serializes a tag list for storage in a JSON `TEXT` column.
pub fn encode_tags(values: &[String]) -> String {
    serde_json::to_string(values).unwrap_or_else(|_| "[]".to_string())
}

/// Reads a tag list back from a JSON `TEXT` column. Corrupt or legacy values
/// degrade to an empty list rather than failing the whole read.
pub fn decode_tags(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modes_round_trip_through_their_storage_representation() {
        for mode in [Mode::Research, Mode::Job, Mode::Coding] {
            assert_eq!(Mode::parse(mode.as_str()).expect("parse"), mode);
        }
    }

    #[test]
    fn unknown_mode_is_a_validation_error() {
        let error = Mode::parse("interview").expect_err("should reject");
        assert_eq!(error.kind(), crate::error::ErrorKind::Validation);
    }

    #[test]
    fn answer_lengths_round_trip_and_scale_the_token_budget() {
        for length in [AnswerLength::Short, AnswerLength::Medium, AnswerLength::Detailed] {
            assert_eq!(AnswerLength::parse(length.as_str()).expect("parse"), length);
        }

        assert!(AnswerLength::Short.max_output_tokens() < AnswerLength::Medium.max_output_tokens());
        assert!(
            AnswerLength::Medium.max_output_tokens() < AnswerLength::Detailed.max_output_tokens()
        );
    }

    #[test]
    fn required_text_is_trimmed() {
        assert_eq!(require_text("Name", "  Ada  ", 50).expect("valid"), "Ada");
    }

    #[test]
    fn required_text_rejects_blank_and_overlong_input() {
        assert!(require_text("Name", "   ", 50).is_err());
        assert!(require_text("Name", &"x".repeat(51), 50).is_err());
    }

    #[test]
    fn optional_text_maps_blank_to_none() {
        assert_eq!(optional_text(Some("   ".into()), 50).expect("valid"), None);
        assert_eq!(optional_text(Some(" hi ".into()), 50).expect("valid"), Some("hi".into()));
        assert_eq!(optional_text(None, 50).expect("valid"), None);
    }

    #[test]
    fn tags_are_trimmed_deduplicated_case_insensitively_and_ordered() {
        let tags = normalize_tags(
            vec!["Rust".into(), " rust ".into(), "".into(), "TypeScript".into()],
            10,
        )
        .expect("valid");

        assert_eq!(tags, vec!["Rust".to_string(), "TypeScript".to_string()]);
    }

    #[test]
    fn tag_lists_are_capped() {
        let many: Vec<String> = (0..11).map(|i| format!("tag{i}")).collect();
        assert!(normalize_tags(many, 10).is_err());
    }

    #[test]
    fn tag_encoding_round_trips_and_tolerates_corruption() {
        let tags = vec!["Rust".to_string(), "PipeWire".to_string()];
        assert_eq!(decode_tags(&encode_tags(&tags)), tags);
        assert!(decode_tags("not json").is_empty());
    }

    #[test]
    fn timestamps_are_utc_rfc3339_and_sort_lexicographically() {
        let stamp = now_timestamp();
        assert!(stamp.ends_with('Z'), "expected UTC designator in `{stamp}`");
        assert!(chrono::DateTime::parse_from_rfc3339(&stamp).is_ok());
        assert!("2026-01-01T00:00:00.000Z" < "2026-01-02T00:00:00.000Z");
    }

    #[test]
    fn ids_are_unique() {
        assert_ne!(new_id(), new_id());
    }
}
