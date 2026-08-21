//! Profile commands.
//!
//! Each command is narrowly scoped and takes an id or a typed input — never a
//! table name, SQL fragment or path (spec §34).

use tauri::State;

use crate::domain::profile::{Profile, ProfileInput, ProfileSummary};
use crate::error::CommandResult;
use crate::repo::profiles as repo;
use crate::state::AppState;

/// Lists profiles with child counts and the active flag, newest activity first.
#[tauri::command]
pub async fn list_profiles(state: State<'_, AppState>) -> CommandResult<Vec<ProfileSummary>> {
    Ok(repo::list(&state.db).await?)
}

/// Loads one complete profile.
#[tauri::command]
pub async fn get_profile(state: State<'_, AppState>, id: String) -> CommandResult<Profile> {
    Ok(repo::get(&state.db, &id).await?)
}

/// Returns the active profile, or `null` when none is selected.
#[tauri::command]
pub async fn get_active_profile(state: State<'_, AppState>) -> CommandResult<Option<Profile>> {
    Ok(repo::active(&state.db).await?)
}

/// Creates a profile from validated input.
#[tauri::command]
pub async fn create_profile(
    state: State<'_, AppState>,
    input: ProfileInput,
) -> CommandResult<Profile> {
    Ok(repo::create(&state.db, input).await?)
}

/// Replaces an existing profile.
#[tauri::command]
pub async fn update_profile(
    state: State<'_, AppState>,
    id: String,
    input: ProfileInput,
) -> CommandResult<Profile> {
    Ok(repo::update(&state.db, &id, input).await?)
}

/// Copies a profile under a new name with fresh child ids.
#[tauri::command]
pub async fn duplicate_profile(state: State<'_, AppState>, id: String) -> CommandResult<Profile> {
    Ok(repo::duplicate(&state.db, &id).await?)
}

/// Deletes a profile and clears it from settings if it was active.
#[tauri::command]
pub async fn delete_profile(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    Ok(repo::delete(&state.db, &id).await?)
}

/// Marks a profile active. Returns the profile so the UI can update without a
/// second round trip.
#[tauri::command]
pub async fn set_active_profile(state: State<'_, AppState>, id: String) -> CommandResult<Profile> {
    Ok(repo::set_active(&state.db, &id).await?)
}
