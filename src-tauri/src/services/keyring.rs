//! Credential storage backed by the OS keyring (Secret Service on Linux).
//!
//! # Rules this module exists to enforce
//!
//! * API keys are **never** written to SQLite, config files, logs or the
//!   frontend bundle (spec §27).
//! * A stored secret is **write-only** from the UI's point of view. The
//!   frontend can set it, ask whether one exists, and delete it — it can never
//!   read it back. Only Rust-side provider adapters retrieve the plaintext, and
//!   only when building an outbound request.
//! * Nothing here ever logs a secret, or its length, or a prefix.
//!
//! On Ubuntu this talks to GNOME Keyring (or KWallet) over D-Bus. If no keyring
//! daemon is running — a headless session, for example — operations fail with a
//! [`crate::error::ErrorKind::Credential`] error explaining how to fix it,
//! rather than silently downgrading to plaintext storage.

use keyring::Entry;

use crate::domain::settings::ProviderKind;
use crate::error::{AppError, AppResult};

/// Collection name shown in tools like Seahorse.
const SERVICE: &str = "dev.zaper.app";

/// Builds the keyring entry for a provider's API key.
fn entry(provider: ProviderKind) -> AppResult<Entry> {
    if !provider.requires_credential() {
        return Err(AppError::validation(
            "The mock provider does not use an API key. Choose a cloud provider first.",
        ));
    }

    Entry::new(SERVICE, provider.as_str()).map_err(|error| {
        // `error` is a keyring error; it describes the backend problem and never
        // contains the secret itself.
        AppError::Credential(format!("could not open the keyring entry: {error}"))
    })
}

/// Stores (or replaces) the API key for `provider`.
pub fn set_api_key(provider: ProviderKind, secret: &str) -> AppResult<()> {
    let trimmed = secret.trim();

    if trimmed.is_empty() {
        return Err(AppError::validation("The API key cannot be empty."));
    }

    entry(provider)?
        .set_password(trimmed)
        .map_err(|error| AppError::Credential(format!("could not save the credential: {error}")))?;

    // Deliberately logs *that* a key was stored, never anything about its value.
    tracing::info!(provider = provider.as_str(), "credential stored");

    Ok(())
}

/// Retrieves the API key for `provider`. Rust-internal use only — no command
/// returns this value to the frontend.
pub fn api_key(provider: ProviderKind) -> AppResult<Option<String>> {
    match entry(provider)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(AppError::Credential(format!("could not read the credential: {error}"))),
    }
}

/// Whether a credential is stored for `provider`, without revealing it.
pub fn has_api_key(provider: ProviderKind) -> AppResult<bool> {
    Ok(api_key(provider)?.is_some())
}

/// Removes the stored credential. Deleting an absent entry succeeds, so the UI
/// can offer "Remove" unconditionally and stay idempotent.
pub fn delete_api_key(provider: ProviderKind) -> AppResult<()> {
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            tracing::info!(provider = provider.as_str(), "credential removed");
            Ok(())
        }
        Err(error) => {
            Err(AppError::Credential(format!("could not remove the credential: {error}")))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // These tests intentionally avoid touching the real keyring: CI and build
    // containers have no Secret Service, and a test must never write to the
    // developer's actual login keyring. What is verified here is the guard
    // logic that runs *before* any D-Bus call.

    #[test]
    fn the_mock_provider_is_rejected_before_any_keyring_access() {
        let error = set_api_key(ProviderKind::Mock, "irrelevant").expect_err("must be rejected");
        assert_eq!(error.kind(), crate::error::ErrorKind::Validation);
    }

    #[test]
    fn an_empty_key_is_rejected_before_any_keyring_access() {
        let error = set_api_key(ProviderKind::OpenAi, "   ").expect_err("must be rejected");
        assert_eq!(error.kind(), crate::error::ErrorKind::Validation);
        assert!(error.user_message().contains("cannot be empty"));
    }

    #[test]
    fn credential_errors_are_reported_as_a_keyring_problem_not_a_crash() {
        // Whatever the backend does on this machine — present, absent, locked —
        // the failure mode must stay inside the Credential category so the UI
        // can tell the user to unlock their keyring.
        if let Err(error) = has_api_key(ProviderKind::OpenAi) {
            assert_eq!(error.kind(), crate::error::ErrorKind::Credential);
            assert!(error.user_message().contains("keyring"));
        }
    }

    #[test]
    fn provider_account_names_are_stable() {
        // The keyring account name is persistent storage: renaming it would
        // orphan every already-saved credential.
        assert_eq!(ProviderKind::OpenAi.as_str(), "openai");
        assert_eq!(ProviderKind::Anthropic.as_str(), "anthropic");
        assert_eq!(ProviderKind::Google.as_str(), "google");
        assert_eq!(ProviderKind::OpenAiCompatible.as_str(), "openai-compatible");
    }
}
