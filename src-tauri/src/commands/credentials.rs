//! Credential commands.
//!
//! The API surface here is deliberately write-only: the frontend can save,
//! check and delete a credential, but there is **no** `get_api_key` command.
//! Plaintext keys never cross the IPC boundary — only Rust-side provider
//! adapters read them, and only to sign an outbound request.
//!
//! Keyring access is blocking D-Bus I/O, so each command hops onto a blocking
//! thread instead of stalling the async runtime (and with it the UI).

use serde::Serialize;
use tauri::State;

use crate::domain::settings::ProviderKind;
use crate::error::{AppError, CommandResult};
use crate::repo::settings as settings_repo;
use crate::services::keyring;
use crate::state::AppState;

/// Whether a credential exists for one provider. Mirrored by
/// `credentialStatusSchema` in `src/types/ipc.ts`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    pub provider: ProviderKind,
    pub configured: bool,
}

/// Stores or replaces the API key for a provider.
#[tauri::command]
pub async fn set_provider_credential(
    provider: ProviderKind,
    secret: String,
) -> CommandResult<CredentialStatus> {
    run_blocking(move || {
        keyring::set_api_key(provider, &secret)?;
        Ok(CredentialStatus { provider, configured: true })
    })
    .await
}

/// Reports whether a credential is stored, without revealing it.
#[tauri::command]
pub async fn get_credential_status(provider: ProviderKind) -> CommandResult<CredentialStatus> {
    run_blocking(move || {
        let configured = keyring::has_api_key(provider)?;
        Ok(CredentialStatus { provider, configured })
    })
    .await
}

/// Reports credential status for every provider the current settings actually
/// use, so the settings screen resolves its whole state in one round trip.
///
/// Providers that need no key (the mock) are omitted rather than reported as
/// "not configured", which would read as a problem the user has to fix.
#[tauri::command]
pub async fn list_credential_status(
    state: State<'_, AppState>,
) -> CommandResult<Vec<CredentialStatus>> {
    let providers = settings_repo::load(&state.db).await?.providers.credential_providers();

    run_blocking(move || {
        let mut statuses = Vec::with_capacity(providers.len());

        for provider in providers {
            statuses
                .push(CredentialStatus { provider, configured: keyring::has_api_key(provider)? });
        }

        Ok(statuses)
    })
    .await
}

/// Removes a stored credential. Idempotent.
#[tauri::command]
pub async fn delete_provider_credential(provider: ProviderKind) -> CommandResult<CredentialStatus> {
    run_blocking(move || {
        keyring::delete_api_key(provider)?;
        Ok(CredentialStatus { provider, configured: false })
    })
    .await
}

/// Runs blocking keyring work off the async runtime.
async fn run_blocking<T, F>(task: F) -> CommandResult<T>
where
    F: FnOnce() -> crate::error::AppResult<T> + Send + 'static,
    T: Send + 'static,
{
    let joined = tokio::task::spawn_blocking(task).await;

    match joined {
        Ok(result) => Ok(result?),
        Err(error) => {
            Err(AppError::internal(format!("credential task did not complete: {error}")).into())
        }
    }
}
