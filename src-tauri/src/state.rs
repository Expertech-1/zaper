//! Shared application state managed by Tauri and injected into commands.

use crate::db::Db;

/// State available to every `#[tauri::command]` via `tauri::State<AppState>`.
///
/// Intentionally small: it holds handles, not mutable business state. Feature
/// state (assistant lifecycle, audio session, meeting session) will be added as
/// dedicated, individually locked members rather than one global mutex — see
/// the architecture note on avoiding global mutable state.
pub struct AppState {
    /// Connection pool for the local SQLite database.
    pub db: Db,
}

impl AppState {
    pub fn new(db: Db) -> Self {
        AppState { db }
    }
}
