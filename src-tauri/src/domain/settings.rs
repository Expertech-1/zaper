//! User settings: the single, validated source of truth for how the assistant
//! behaves (spec §42).
//!
//! # Storage strategy
//!
//! Settings are persisted as one JSON document in the `settings` key/value
//! table under [`SETTINGS_KEY`]. Every field carries `#[serde(default)]`, so a
//! document written by an older build still loads after new fields are added —
//! no migration needed for a new preference. Structural changes bump
//! [`SCHEMA_VERSION`].
//!
//! # Secrets
//!
//! There is deliberately no `api_key` field. Credentials live in the OS keyring
//! (`services::keyring`) and are referenced by provider, never stored here and
//! never returned to the frontend.

use serde::{Deserialize, Serialize};

use super::common::{AnswerLength, Mode, Theme};
use crate::error::{AppError, AppResult};

/// Key under which the settings document is stored.
pub const SETTINGS_KEY: &str = "app.settings";

/// Bumped only for structural changes that need real migration logic.
pub const SCHEMA_VERSION: u32 = 1;

/// Upper bound for the "wait before answering" delay (spec §15: roughly 0–9s).
pub const MAX_RESPONSE_DELAY_MS: u32 = 9_000;

const MIN_TIMEOUT_SECS: u32 = 5;
const MAX_TIMEOUT_SECS: u32 = 300;
const MAX_TEMPERATURE: f32 = 2.0;
const MAX_OUTPUT_TOKENS: u32 = 32_000;
const MIN_TTS_SPEED: f32 = 0.5;
const MAX_TTS_SPEED: f32 = 2.0;

/// Which cloud vendor an adapter talks to. `Mock` keeps the whole app usable
/// (and testable) with no credentials and no network.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ProviderKind {
    #[default]
    Mock,
    OpenAi,
    Anthropic,
    Google,
    /// Any OpenAI-wire-compatible endpoint (self-hosted gateway, DeepSeek, ...).
    OpenAiCompatible,
}

impl ProviderKind {
    /// Stable identifier used as the keyring account name.
    pub fn as_str(self) -> &'static str {
        match self {
            ProviderKind::Mock => "mock",
            ProviderKind::OpenAi => "openai",
            ProviderKind::Anthropic => "anthropic",
            ProviderKind::Google => "google",
            ProviderKind::OpenAiCompatible => "openai-compatible",
        }
    }

    /// Whether this provider needs an API key before it can be used.
    pub fn requires_credential(self) -> bool {
        !matches!(self, ProviderKind::Mock)
    }

    /// Whether the user must supply the endpoint themselves.
    pub fn requires_endpoint(self) -> bool {
        matches!(self, ProviderKind::OpenAiCompatible)
    }
}

/// Configuration for one AI capability (LLM, STT, TTS or vision).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    #[serde(default)]
    pub provider: ProviderKind,
    #[serde(default)]
    pub model: String,
    /// Base URL override. Required for [`ProviderKind::OpenAiCompatible`].
    #[serde(default)]
    pub endpoint: Option<String>,
    #[serde(default = "default_timeout_secs")]
    pub timeout_secs: u32,
    #[serde(default)]
    pub temperature: Option<f32>,
    /// Hard ceiling on output tokens. `None` means "let the answer-length
    /// setting decide" (see [`AnswerLength::max_output_tokens`]).
    #[serde(default)]
    pub max_output_tokens: Option<u32>,
}

fn default_timeout_secs() -> u32 {
    60
}

impl Default for ProviderConfig {
    fn default() -> Self {
        ProviderConfig {
            provider: ProviderKind::Mock,
            model: String::new(),
            endpoint: None,
            timeout_secs: default_timeout_secs(),
            temperature: None,
            max_output_tokens: None,
        }
    }
}

impl ProviderConfig {
    fn validate(self, capability: &'static str) -> AppResult<Self> {
        let model = self.model.trim().to_string();

        if self.provider.requires_credential() && model.is_empty() {
            return Err(AppError::validation(format!(
                "Choose a {capability} model for the selected provider."
            )));
        }

        let endpoint = match self.endpoint {
            Some(raw) if !raw.trim().is_empty() => {
                let trimmed = raw.trim();
                if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
                    return Err(AppError::validation(format!(
                        "The {capability} endpoint must start with https:// or http://."
                    )));
                }
                // Trailing slashes make adapter URL joining ambiguous.
                Some(trimmed.trim_end_matches('/').to_string())
            }
            _ => None,
        };

        if self.provider.requires_endpoint() && endpoint.is_none() {
            return Err(AppError::validation(format!(
                "An endpoint URL is required for the {capability} provider."
            )));
        }

        if !(MIN_TIMEOUT_SECS..=MAX_TIMEOUT_SECS).contains(&self.timeout_secs) {
            return Err(AppError::validation(format!(
                "The {capability} timeout must be between {MIN_TIMEOUT_SECS} and \
                 {MAX_TIMEOUT_SECS} seconds."
            )));
        }

        if let Some(temperature) = self.temperature {
            if !temperature.is_finite() || !(0.0..=MAX_TEMPERATURE).contains(&temperature) {
                return Err(AppError::validation(format!(
                    "The {capability} temperature must be between 0 and {MAX_TEMPERATURE}."
                )));
            }
        }

        if let Some(tokens) = self.max_output_tokens {
            if tokens == 0 || tokens > MAX_OUTPUT_TOKENS {
                return Err(AppError::validation(format!(
                    "The {capability} output-token limit must be between 1 and \
                     {MAX_OUTPUT_TOKENS}."
                )));
            }
        }

        Ok(ProviderConfig { model, endpoint, ..self })
    }
}

/// One [`ProviderConfig`] per AI capability, so the user can mix vendors
/// (e.g. OpenAI for speech, Anthropic for reasoning).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSettings {
    #[serde(default)]
    pub llm: ProviderConfig,
    #[serde(default)]
    pub stt: ProviderConfig,
    #[serde(default)]
    pub tts: ProviderConfig,
    #[serde(default)]
    pub vision: ProviderConfig,
}

impl ProviderSettings {
    fn validate(self) -> AppResult<Self> {
        Ok(ProviderSettings {
            llm: self.llm.validate("language model")?,
            stt: self.stt.validate("speech-to-text")?,
            tts: self.tts.validate("text-to-speech")?,
            vision: self.vision.validate("vision")?,
        })
    }

    /// Distinct providers that need a credential — what the settings UI must
    /// prompt for and what onboarding checks.
    pub fn credential_providers(&self) -> Vec<ProviderKind> {
        let mut out: Vec<ProviderKind> = Vec::new();
        for config in [&self.llm, &self.stt, &self.tts, &self.vision] {
            if config.provider.requires_credential() && !out.contains(&config.provider) {
                out.push(config.provider);
            }
        }
        out
    }
}

/// Spoken-answer ("earpiece") settings.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub voice: Option<String>,
    #[serde(default = "default_tts_speed")]
    pub speed: f32,
    #[serde(default = "default_tts_volume")]
    pub volume: f32,
}

fn default_tts_speed() -> f32 {
    1.0
}

fn default_tts_volume() -> f32 {
    0.8
}

impl Default for TtsSettings {
    fn default() -> Self {
        TtsSettings {
            enabled: false,
            voice: None,
            speed: default_tts_speed(),
            volume: default_tts_volume(),
        }
    }
}

impl TtsSettings {
    fn validate(self) -> AppResult<Self> {
        if !self.speed.is_finite() || !(MIN_TTS_SPEED..=MAX_TTS_SPEED).contains(&self.speed) {
            return Err(AppError::validation(format!(
                "Speech speed must be between {MIN_TTS_SPEED} and {MAX_TTS_SPEED}."
            )));
        }

        if !self.volume.is_finite() || !(0.0..=1.0).contains(&self.volume) {
            return Err(AppError::validation("Speech volume must be between 0 and 1."));
        }

        let voice = self.voice.and_then(|v| {
            let trimmed = v.trim().to_string();
            (!trimmed.is_empty()).then_some(trimmed)
        });

        Ok(TtsSettings { voice, ..self })
    }
}

/// Audio capture preferences. Device identifiers are opaque strings supplied by
/// the audio backend (M3); `None` means "system default".
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSettings {
    #[serde(default)]
    pub microphone_device: Option<String>,
    #[serde(default)]
    pub system_audio_source: Option<String>,
    #[serde(default = "default_true")]
    pub capture_microphone: bool,
    #[serde(default = "default_true")]
    pub capture_system_audio: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AudioSettings {
    fn default() -> Self {
        AudioSettings {
            microphone_device: None,
            system_audio_source: None,
            capture_microphone: true,
            capture_system_audio: true,
        }
    }
}

impl AudioSettings {
    fn validate(self) -> AppResult<Self> {
        if !self.capture_microphone && !self.capture_system_audio {
            return Err(AppError::validation(
                "Enable at least one audio source — microphone or system audio.",
            ));
        }
        Ok(self)
    }
}

/// Global shortcut accelerators. An empty string means "not bound", which is a
/// legitimate choice on compositors that refuse global registration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Shortcuts {
    #[serde(default = "default_toggle_assistant")]
    pub toggle_assistant: String,
    #[serde(default = "default_read_screen")]
    pub read_screen: String,
    #[serde(default = "default_toggle_meeting")]
    pub toggle_meeting: String,
    #[serde(default = "default_toggle_listening")]
    pub toggle_listening: String,
    #[serde(default = "default_regenerate_answer")]
    pub regenerate_answer: String,
}

fn default_toggle_assistant() -> String {
    "Ctrl+Space".to_string()
}
fn default_read_screen() -> String {
    "Ctrl+Shift+S".to_string()
}
fn default_toggle_meeting() -> String {
    "Ctrl+Shift+M".to_string()
}
fn default_toggle_listening() -> String {
    "Ctrl+Shift+L".to_string()
}
fn default_regenerate_answer() -> String {
    "Ctrl+Shift+R".to_string()
}

impl Default for Shortcuts {
    fn default() -> Self {
        Shortcuts {
            toggle_assistant: default_toggle_assistant(),
            read_screen: default_read_screen(),
            toggle_meeting: default_toggle_meeting(),
            toggle_listening: default_toggle_listening(),
            regenerate_answer: default_regenerate_answer(),
        }
    }
}

const MODIFIERS: [&str; 8] =
    ["ctrl", "control", "alt", "option", "shift", "super", "meta", "cmdorctrl"];

impl Shortcuts {
    fn validate(self) -> AppResult<Self> {
        let entries = [
            ("Show/hide assistant", &self.toggle_assistant),
            ("Read screen", &self.read_screen),
            ("Toggle meeting mode", &self.toggle_meeting),
            ("Toggle listening", &self.toggle_listening),
            ("Regenerate answer", &self.regenerate_answer),
        ];

        for (label, accelerator) in entries {
            validate_accelerator(label, accelerator)?;
        }

        // A duplicate binding would silently shadow one of the actions.
        let bound: Vec<String> = entries
            .iter()
            .map(|(_, accelerator)| accelerator.trim().to_lowercase())
            .filter(|a| !a.is_empty())
            .collect();

        for (index, accelerator) in bound.iter().enumerate() {
            if bound[index + 1..].contains(accelerator) {
                return Err(AppError::validation(
                    "Two actions are bound to the same shortcut. Give each action a unique one.",
                ));
            }
        }

        Ok(self)
    }
}

/// Checks a Tauri-style accelerator such as `Ctrl+Shift+S`.
fn validate_accelerator(label: &str, accelerator: &str) -> AppResult<()> {
    let trimmed = accelerator.trim();

    // Unbound is allowed on purpose (Wayland compositors may refuse to register).
    if trimmed.is_empty() {
        return Ok(());
    }

    let parts: Vec<&str> = trimmed.split('+').map(str::trim).collect();

    if parts.iter().any(|part| part.is_empty()) {
        return Err(AppError::validation(format!(
            "The shortcut for “{label}” is malformed. Use a form like Ctrl+Shift+S."
        )));
    }

    let (key, modifiers) = parts.split_last().expect("non-empty after the check above");

    if modifiers.is_empty() {
        return Err(AppError::validation(format!(
            "The shortcut for “{label}” needs at least one modifier (Ctrl, Alt, Shift or Super)."
        )));
    }

    for modifier in modifiers {
        if !MODIFIERS.contains(&modifier.to_lowercase().as_str()) {
            return Err(AppError::validation(format!(
                "“{modifier}” is not a valid modifier for the “{label}” shortcut."
            )));
        }
    }

    if MODIFIERS.contains(&key.to_lowercase().as_str()) {
        return Err(AppError::validation(format!(
            "The shortcut for “{label}” must end with a key, not a modifier."
        )));
    }

    Ok(())
}

/// The complete settings document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub active_profile_id: Option<String>,
    #[serde(default)]
    pub default_mode: Mode,
    #[serde(default)]
    pub answer_length: AnswerLength,
    /// How long to wait after a detected question before answering.
    #[serde(default = "default_response_delay_ms")]
    pub response_delay_ms: u32,
    /// BCP-47 tag, or `auto` to follow the provider's detection.
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub theme: Theme,
    /// Verbose local logging. Off by default so transcripts are never written
    /// to disk without an explicit opt-in (see PRIVACY.md).
    #[serde(default)]
    pub diagnostic_logging: bool,
    #[serde(default)]
    pub onboarding_completed: bool,
    #[serde(default)]
    pub providers: ProviderSettings,
    #[serde(default)]
    pub tts: TtsSettings,
    #[serde(default)]
    pub audio: AudioSettings,
    #[serde(default)]
    pub shortcuts: Shortcuts,
}

fn default_schema_version() -> u32 {
    SCHEMA_VERSION
}

fn default_response_delay_ms() -> u32 {
    1_500
}

fn default_language() -> String {
    "auto".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            schema_version: SCHEMA_VERSION,
            active_profile_id: None,
            default_mode: Mode::default(),
            answer_length: AnswerLength::default(),
            response_delay_ms: default_response_delay_ms(),
            language: default_language(),
            theme: Theme::default(),
            diagnostic_logging: false,
            onboarding_completed: false,
            providers: ProviderSettings::default(),
            tts: TtsSettings::default(),
            audio: AudioSettings::default(),
            shortcuts: Shortcuts::default(),
        }
    }
}

impl Settings {
    /// Validates and normalizes the whole document. Called on every write, and
    /// on read so a hand-edited file cannot put the app into a bad state.
    pub fn validate(self) -> AppResult<Self> {
        if self.response_delay_ms > MAX_RESPONSE_DELAY_MS {
            return Err(AppError::validation(format!(
                "The response delay must be between 0 and {} seconds.",
                MAX_RESPONSE_DELAY_MS / 1_000
            )));
        }

        let language = self.language.trim().to_string();
        if language.is_empty() {
            return Err(AppError::validation("Choose a language, or 'auto'."));
        }
        if language != "auto"
            && !language.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return Err(AppError::validation(
                "The language must be 'auto' or a language tag such as en, en-GB or fr.",
            ));
        }

        let active_profile_id = self.active_profile_id.and_then(|id| {
            let trimmed = id.trim().to_string();
            (!trimmed.is_empty()).then_some(trimmed)
        });

        Ok(Settings {
            schema_version: SCHEMA_VERSION,
            active_profile_id,
            language,
            providers: self.providers.validate()?,
            tts: self.tts.validate()?,
            audio: self.audio.validate()?,
            shortcuts: self.shortcuts.validate()?,
            ..self
        })
    }

    /// Effective output-token ceiling for an answer: the provider's explicit
    /// limit when set, otherwise the budget implied by the answer length.
    #[allow(dead_code, reason = "consumed by the LLM adapters in M2")]
    pub fn effective_max_output_tokens(&self) -> u32 {
        self.providers
            .llm
            .max_output_tokens
            .unwrap_or_else(|| self.answer_length.max_output_tokens())
    }

    /// Whether the app can reach a real cloud model, or is running on mocks.
    #[allow(dead_code, reason = "consumed by the onboarding and offline checks in M2")]
    pub fn uses_cloud_llm(&self) -> bool {
        self.providers.llm.provider.requires_credential()
    }
}

/// Distinguishes "field absent" from "field explicitly null".
///
/// Serde maps a JSON `null` onto `None` for a plain `Option<T>`, which would
/// make "clear the active profile" indistinguishable from "leave it alone". The
/// extra layer makes the intent explicit: `None` = absent, `Some(None)` = clear.
fn double_option<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Deserialize::deserialize(deserializer).map(Some)
}

/// Partial update sent by the settings UI. Absent fields are left untouched;
/// nested sections are replaced wholesale because the form edits them as units.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    #[serde(default, deserialize_with = "double_option")]
    pub active_profile_id: Option<Option<String>>,
    #[serde(default)]
    pub default_mode: Option<Mode>,
    #[serde(default)]
    pub answer_length: Option<AnswerLength>,
    #[serde(default)]
    pub response_delay_ms: Option<u32>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub theme: Option<Theme>,
    #[serde(default)]
    pub diagnostic_logging: Option<bool>,
    #[serde(default)]
    pub onboarding_completed: Option<bool>,
    #[serde(default)]
    pub providers: Option<ProviderSettings>,
    #[serde(default)]
    pub tts: Option<TtsSettings>,
    #[serde(default)]
    pub audio: Option<AudioSettings>,
    #[serde(default)]
    pub shortcuts: Option<Shortcuts>,
}

impl SettingsPatch {
    /// Applies this patch to `base` and validates the result, so a partial
    /// update can never bypass an invariant.
    pub fn apply(self, base: Settings) -> AppResult<Settings> {
        let merged = Settings {
            schema_version: SCHEMA_VERSION,
            active_profile_id: self.active_profile_id.unwrap_or(base.active_profile_id),
            default_mode: self.default_mode.unwrap_or(base.default_mode),
            answer_length: self.answer_length.unwrap_or(base.answer_length),
            response_delay_ms: self.response_delay_ms.unwrap_or(base.response_delay_ms),
            language: self.language.unwrap_or(base.language),
            theme: self.theme.unwrap_or(base.theme),
            diagnostic_logging: self.diagnostic_logging.unwrap_or(base.diagnostic_logging),
            onboarding_completed: self.onboarding_completed.unwrap_or(base.onboarding_completed),
            providers: self.providers.unwrap_or(base.providers),
            tts: self.tts.unwrap_or(base.tts),
            audio: self.audio.unwrap_or(base.audio),
            shortcuts: self.shortcuts.unwrap_or(base.shortcuts),
        };

        merged.validate()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn patch_json(json: &str) -> SettingsPatch {
        serde_json::from_str(json).expect("patch should deserialize")
    }

    #[test]
    fn defaults_are_valid_and_offline_friendly() {
        let settings = Settings::default().validate().expect("defaults must be valid");

        assert_eq!(settings.providers.llm.provider, ProviderKind::Mock);
        assert!(!settings.uses_cloud_llm(), "a fresh install must not require credentials");
        assert!(!settings.diagnostic_logging, "verbose logging must be opt-in");
        assert!(!settings.tts.enabled, "speaking aloud must be opt-in");
    }

    #[test]
    fn a_document_from_an_older_build_still_loads() {
        // Only a couple of fields; everything else must fall back to defaults.
        let stored = r#"{"answerLength":"short","responseDelayMs":2000}"#;
        let settings: Settings = serde_json::from_str(stored).expect("should deserialize");
        let settings = settings.validate().expect("should validate");

        assert_eq!(settings.answer_length, AnswerLength::Short);
        assert_eq!(settings.response_delay_ms, 2_000);
        assert_eq!(settings.default_mode, Mode::Research);
        assert_eq!(settings.schema_version, SCHEMA_VERSION);
    }

    #[test]
    fn response_delay_is_capped_at_nine_seconds() {
        let ok = Settings { response_delay_ms: MAX_RESPONSE_DELAY_MS, ..Default::default() };
        assert!(ok.validate().is_ok());

        let too_slow =
            Settings { response_delay_ms: MAX_RESPONSE_DELAY_MS + 1, ..Default::default() };
        assert!(too_slow.validate().is_err());
    }

    #[test]
    fn a_patch_only_touches_the_fields_it_carries() {
        let base = Settings { response_delay_ms: 4_000, ..Default::default() };
        let updated = patch_json(r#"{"answerLength":"detailed"}"#).apply(base).expect("valid");

        assert_eq!(updated.answer_length, AnswerLength::Detailed);
        assert_eq!(updated.response_delay_ms, 4_000, "untouched field must survive");
    }

    #[test]
    fn a_patch_can_explicitly_clear_the_active_profile() {
        let base = Settings { active_profile_id: Some("p1".into()), ..Default::default() };

        let cleared = patch_json(r#"{"activeProfileId":null}"#).apply(base.clone()).expect("valid");
        assert_eq!(cleared.active_profile_id, None);

        let untouched = patch_json("{}").apply(base).expect("valid");
        assert_eq!(untouched.active_profile_id, Some("p1".into()));
    }

    #[test]
    fn a_patch_cannot_bypass_validation() {
        let result = patch_json(r#"{"responseDelayMs":60000}"#).apply(Settings::default());
        assert!(result.is_err(), "patched values must be validated");
    }

    #[test]
    fn cloud_providers_require_a_model() {
        let settings = Settings {
            providers: ProviderSettings {
                llm: ProviderConfig { provider: ProviderKind::OpenAi, ..Default::default() },
                ..Default::default()
            },
            ..Default::default()
        };

        let error = settings.validate().expect_err("missing model must fail");
        assert!(error.user_message().contains("model"));
    }

    #[test]
    fn openai_compatible_requires_an_endpoint() {
        let settings = Settings {
            providers: ProviderSettings {
                llm: ProviderConfig {
                    provider: ProviderKind::OpenAiCompatible,
                    model: "some-model".into(),
                    ..Default::default()
                },
                ..Default::default()
            },
            ..Default::default()
        };

        assert!(settings.validate().is_err());
    }

    #[test]
    fn endpoints_must_be_http_urls_and_lose_trailing_slashes() {
        let make = |endpoint: &str| Settings {
            providers: ProviderSettings {
                llm: ProviderConfig {
                    provider: ProviderKind::OpenAiCompatible,
                    model: "m".into(),
                    endpoint: Some(endpoint.into()),
                    ..Default::default()
                },
                ..Default::default()
            },
            ..Default::default()
        };

        assert!(make("ftp://example.com").validate().is_err());

        let ok = make("https://gateway.example.com/v1/").validate().expect("valid");
        assert_eq!(ok.providers.llm.endpoint.as_deref(), Some("https://gateway.example.com/v1"));
    }

    #[test]
    fn out_of_range_generation_parameters_are_rejected() {
        let make = |temperature: Option<f32>, tokens: Option<u32>| Settings {
            providers: ProviderSettings {
                llm: ProviderConfig {
                    provider: ProviderKind::OpenAi,
                    model: "m".into(),
                    temperature,
                    max_output_tokens: tokens,
                    ..Default::default()
                },
                ..Default::default()
            },
            ..Default::default()
        };

        assert!(make(Some(3.0), None).validate().is_err());
        assert!(make(Some(f32::NAN), None).validate().is_err());
        assert!(make(None, Some(0)).validate().is_err());
        assert!(make(Some(0.7), Some(2_000)).validate().is_ok());
    }

    #[test]
    fn answer_length_drives_the_token_budget_unless_overridden() {
        let settings = Settings { answer_length: AnswerLength::Short, ..Default::default() };
        assert_eq!(settings.effective_max_output_tokens(), AnswerLength::Short.max_output_tokens());

        let overridden = Settings {
            answer_length: AnswerLength::Short,
            providers: ProviderSettings {
                llm: ProviderConfig {
                    provider: ProviderKind::OpenAi,
                    model: "m".into(),
                    max_output_tokens: Some(999),
                    ..Default::default()
                },
                ..Default::default()
            },
            ..Default::default()
        };
        assert_eq!(overridden.effective_max_output_tokens(), 999);
    }

    #[test]
    fn tts_speed_and_volume_are_bounded() {
        let make = |speed: f32, volume: f32| Settings {
            tts: TtsSettings { enabled: true, voice: None, speed, volume },
            ..Default::default()
        };

        assert!(make(0.1, 0.5).validate().is_err());
        assert!(make(3.0, 0.5).validate().is_err());
        assert!(make(1.0, 1.5).validate().is_err());
        assert!(make(1.0, 0.5).validate().is_ok());
    }

    #[test]
    fn at_least_one_audio_source_must_stay_enabled() {
        let settings = Settings {
            audio: AudioSettings {
                capture_microphone: false,
                capture_system_audio: false,
                ..Default::default()
            },
            ..Default::default()
        };

        assert!(settings.validate().is_err());
    }

    #[test]
    fn shortcuts_require_a_modifier_and_a_key() {
        assert!(validate_accelerator("Test", "Ctrl+Shift+S").is_ok());
        assert!(validate_accelerator("Test", "").is_ok(), "unbound is allowed");
        assert!(validate_accelerator("Test", "S").is_err(), "bare key would hijack typing");
        assert!(validate_accelerator("Test", "Ctrl+").is_err());
        assert!(validate_accelerator("Test", "Ctrl+Shift").is_err(), "must end with a key");
        assert!(validate_accelerator("Test", "Hyper+S").is_err(), "unknown modifier");
    }

    #[test]
    fn duplicate_shortcut_bindings_are_rejected() {
        let settings = Settings {
            shortcuts: Shortcuts {
                toggle_assistant: "Ctrl+Shift+S".into(),
                read_screen: "ctrl+shift+s".into(),
                ..Default::default()
            },
            ..Default::default()
        };

        assert!(settings.validate().is_err(), "clashing accelerators must be caught");
    }

    #[test]
    fn unbound_shortcuts_do_not_count_as_duplicates() {
        let settings = Settings {
            shortcuts: Shortcuts {
                toggle_assistant: String::new(),
                read_screen: String::new(),
                ..Default::default()
            },
            ..Default::default()
        };

        assert!(settings.validate().is_ok());
    }

    #[test]
    fn language_must_be_auto_or_a_language_tag() {
        let make = |language: &str| Settings { language: language.into(), ..Default::default() };

        assert!(make("auto").validate().is_ok());
        assert!(make("en-GB").validate().is_ok());
        assert!(make("  fr  ").validate().is_ok());
        assert!(make("").validate().is_err());
        assert!(make("English (UK)").validate().is_err());
    }

    #[test]
    fn credential_providers_are_deduplicated_and_exclude_mocks() {
        let providers = ProviderSettings {
            llm: ProviderConfig {
                provider: ProviderKind::OpenAi,
                model: "gpt".into(),
                ..Default::default()
            },
            stt: ProviderConfig {
                provider: ProviderKind::OpenAi,
                model: "whisper".into(),
                ..Default::default()
            },
            tts: ProviderConfig::default(),
            vision: ProviderConfig {
                provider: ProviderKind::Anthropic,
                model: "claude".into(),
                ..Default::default()
            },
        };

        assert_eq!(
            providers.credential_providers(),
            vec![ProviderKind::OpenAi, ProviderKind::Anthropic]
        );
    }

    #[test]
    fn settings_survive_a_json_round_trip() {
        let settings = Settings::default().validate().expect("valid");
        let json = serde_json::to_string(&settings).expect("serialize");
        let restored: Settings = serde_json::from_str(&json).expect("deserialize");

        assert_eq!(settings, restored);
    }
}
