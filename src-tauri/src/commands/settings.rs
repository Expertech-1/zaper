//! Settings commands.
//!
//! `get_settings` and `update_settings` are the only way the frontend reads or
//! writes preferences. Note what is *not* here: no command returns an API key.

use tauri::State;

use crate::domain::settings::{Settings, SettingsPatch};
use crate::error::CommandResult;
use crate::repo::settings as repo;
use crate::state::AppState;

/// Returns the current settings document, or defaults on a fresh install.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> CommandResult<Settings> {
    Ok(repo::load(&state.db).await?)
}

/// Applies a partial update and returns the full, validated result so the UI
/// always renders exactly what was persisted.
#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    patch: SettingsPatch,
) -> CommandResult<Settings> {
    Ok(repo::patch(&state.db, patch).await?)
}

/// Restores factory defaults. Credentials in the keyring are untouched — the
/// user removes those explicitly from the provider section.
#[tauri::command]
pub async fn reset_settings(state: State<'_, AppState>) -> CommandResult<Settings> {
    Ok(repo::save(&state.db, Settings::default()).await?)
}
