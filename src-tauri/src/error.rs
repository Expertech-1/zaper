//! Application error taxonomy.
//!
//! Two layers, deliberately separated:
//!
//! * [`AppError`] — the rich internal error used throughout the Rust core. It
//!   keeps technical detail (SQL text, IO messages, D-Bus failures) for the logs.
//! * [`IpcError`] — the serialized shape crossing the IPC boundary. It carries a
//!   machine-readable [`ErrorKind`] plus a human-readable message, so the UI can
//!   distinguish *network* vs *provider* vs *application* vs *cancelled* without
//!   string-matching, per the spec's error-handling requirements.
//!
//! Technical details are logged, not returned, unless they are safe and useful
//! to the user. Secrets are never included in either layer.

use serde::Serialize;

/// Machine-readable error category. The frontend switches on this.
///
/// The taxonomy is complete by design: the UI must be able to distinguish these
/// cases from day one (spec §29), even though the cloud-facing arms are only
/// *constructed* once the provider adapters land in M2.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    /// Caller supplied something invalid (empty name, unknown enum value, ...).
    Validation,
    /// The requested entity does not exist.
    NotFound,
    /// Local persistence failed.
    Database,
    /// OS keyring / Secret Service problem.
    Credential,
    /// Filesystem or path problem.
    Io,
    /// No connectivity, DNS failure, timeout reaching a cloud provider.
    #[allow(dead_code, reason = "constructed by the provider adapters in M2")]
    Network,
    /// A cloud AI provider rejected the request or returned something unusable.
    #[allow(dead_code, reason = "constructed by the provider adapters in M2")]
    Provider,
    /// A platform capability is unavailable on this system (compositor, audio).
    Unsupported,
    /// The user (or the app) cancelled the operation.
    Cancelled,
    /// Anything we did not anticipate.
    Internal,
}

impl ErrorKind {
    /// Whether retrying the same operation could plausibly succeed.
    /// The UI uses this to decide if a "Retry" affordance makes sense.
    pub fn is_retryable(self) -> bool {
        matches!(self, ErrorKind::Network | ErrorKind::Provider | ErrorKind::Database)
    }
}

/// Internal error type for the Rust core.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Validation(String),

    #[error("{entity} '{id}' was not found")]
    NotFound { entity: &'static str, id: String },

    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("database migration failed: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error("credential storage error: {0}")]
    Credential(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    #[allow(dead_code, reason = "constructed by the audio (M3) and screen (M8) backends")]
    Unsupported(String),

    #[error("operation cancelled")]
    #[allow(dead_code, reason = "constructed once streaming operations land in M2")]
    Cancelled,

    #[error("{0}")]
    Internal(String),
}

impl AppError {
    /// Convenience constructor for validation failures.
    pub fn validation(message: impl Into<String>) -> Self {
        AppError::Validation(message.into())
    }

    /// Convenience constructor for missing entities.
    pub fn not_found(entity: &'static str, id: impl Into<String>) -> Self {
        AppError::NotFound { entity, id: id.into() }
    }

    /// Convenience constructor for unexpected internal failures.
    pub fn internal(message: impl Into<String>) -> Self {
        AppError::Internal(message.into())
    }

    /// The category this error belongs to.
    pub fn kind(&self) -> ErrorKind {
        match self {
            AppError::Validation(_) => ErrorKind::Validation,
            AppError::NotFound { .. } => ErrorKind::NotFound,
            AppError::Database(_) | AppError::Migration(_) => ErrorKind::Database,
            AppError::Credential(_) => ErrorKind::Credential,
            AppError::Io(_) => ErrorKind::Io,
            AppError::Unsupported(_) => ErrorKind::Unsupported,
            AppError::Cancelled => ErrorKind::Cancelled,
            AppError::Internal(_) => ErrorKind::Internal,
        }
    }

    /// A message safe and useful to show a user.
    ///
    /// Validation, not-found, unsupported and cancellation messages are written
    /// for humans already, so they pass through. Everything else gets a generic
    /// explanation while the technical cause goes to the log.
    pub fn user_message(&self) -> String {
        match self {
            AppError::Validation(message) => message.clone(),
            AppError::NotFound { entity, .. } => {
                format!("That {entity} no longer exists. It may have been deleted.")
            }
            AppError::Database(_) | AppError::Migration(_) => {
                "Zaper could not read or write its local database. \
                 Your data has not been changed. See the diagnostic log for details."
                    .to_string()
            }
            AppError::Credential(_) => {
                "Zaper could not reach your system keyring, so the credential was not saved. \
                 Make sure a keyring service (GNOME Keyring or KWallet) is running and unlocked."
                    .to_string()
            }
            AppError::Io(_) => {
                "A file operation failed. Check that the file exists and that Zaper has \
                 permission to read it."
                    .to_string()
            }
            AppError::Unsupported(message) => message.clone(),
            AppError::Cancelled => "The operation was cancelled.".to_string(),
            AppError::Internal(_) => {
                "Something went wrong inside Zaper. See the diagnostic log for details.".to_string()
            }
        }
    }
}

/// Wire format for errors returned from `#[tauri::command]` functions.
/// Mirrored by `ipcErrorSchema` in `src/types/ipc.ts`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub kind: ErrorKind,
    pub message: String,
    pub retryable: bool,
}

impl From<AppError> for IpcError {
    fn from(error: AppError) -> Self {
        let kind = error.kind();

        // Log the technical cause once, here, at the boundary. Callers therefore
        // never need to remember to log before returning.
        match kind {
            ErrorKind::Validation | ErrorKind::NotFound | ErrorKind::Cancelled => {
                tracing::debug!(?kind, error = %error, "command rejected");
            }
            _ => {
                tracing::error!(?kind, error = %error, "command failed");
            }
        }

        IpcError { kind, message: error.user_message(), retryable: kind.is_retryable() }
    }
}

/// Result alias for internal core functions.
pub type AppResult<T> = Result<T, AppError>;

/// Result alias for `#[tauri::command]` functions.
pub type CommandResult<T> = Result<T, IpcError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_messages_reach_the_user_verbatim() {
        let error = AppError::validation("Profile name cannot be empty.");
        let ipc: IpcError = error.into();

        assert_eq!(ipc.kind, ErrorKind::Validation);
        assert_eq!(ipc.message, "Profile name cannot be empty.");
        assert!(!ipc.retryable);
    }

    #[test]
    fn database_errors_are_not_leaked_verbatim() {
        let error = AppError::Database(sqlx::Error::RowNotFound);
        let technical = error.to_string();
        let ipc: IpcError = error.into();

        assert_eq!(ipc.kind, ErrorKind::Database);
        assert!(ipc.retryable);
        assert!(!ipc.message.contains(&technical));
        assert!(ipc.message.contains("local database"));
    }

    #[test]
    fn not_found_reports_the_entity_without_echoing_the_id() {
        let error = AppError::not_found("profile", "0d6d2a5e");
        let ipc: IpcError = error.into();

        assert_eq!(ipc.kind, ErrorKind::NotFound);
        assert!(ipc.message.contains("profile"));
        assert!(!ipc.message.contains("0d6d2a5e"));
    }

    #[test]
    fn only_transient_kinds_are_retryable() {
        assert!(ErrorKind::Network.is_retryable());
        assert!(ErrorKind::Provider.is_retryable());
        assert!(!ErrorKind::Validation.is_retryable());
        assert!(!ErrorKind::Cancelled.is_retryable());
        assert!(!ErrorKind::Unsupported.is_retryable());
    }
}
