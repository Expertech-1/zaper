//! Diagnostic logging setup.
//!
//! What is logged: lifecycle events, errors, provider failures, timings, audio
//! and database problems. What is **not** logged by default: microphone audio,
//! transcripts, document contents, prompts, API keys (see PRIVACY.md §Logging).
//!
//! Verbosity is controlled by the `ZAPER_LOG` environment variable using
//! `tracing-subscriber`'s filter syntax, e.g. `ZAPER_LOG=zaper_lib=debug`.
//! Release builds default to `info`, debug builds to `debug`.

use tracing_subscriber::EnvFilter;

/// Environment variable that overrides the log filter.
const ENV_VAR: &str = "ZAPER_LOG";

/// Installs the global tracing subscriber.
///
/// Safe to call once at startup; a second call is ignored rather than panicking,
/// which keeps tests and repeated initialization harmless.
pub fn init() {
    let default_filter = if cfg!(debug_assertions) { "info,zaper_lib=debug" } else { "info" };

    let filter =
        EnvFilter::try_from_env(ENV_VAR).unwrap_or_else(|_| EnvFilter::new(default_filter));

    let result = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_writer(std::io::stderr)
        .try_init();

    if result.is_err() {
        // Already initialized (e.g. a second call in a test binary). Not fatal.
        tracing::debug!("tracing subscriber was already installed");
    }
}
