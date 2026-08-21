//! Zaper — Rust core.
//!
//! Layering (outermost first):
//!
//! ```text
//! commands/   thin IPC surface exposed to React
//! services/   OS integration (keyring today; audio, screen, shortcuts later)
//! repo/       SQL — the only place that talks to the database
//! domain/     pure types + validation, no I/O
//! db/         connection pool + migrations
//! error/      error taxonomy shared by every layer
//! ```
//!
//! Dependencies point inward: `commands` may use everything, `domain` uses
//! nothing but `error`.

mod commands;
mod db;
mod domain;
mod error;
mod logging;
mod repo;
mod services;
mod state;

use tauri::Manager;

use crate::error::AppError;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::init();

    tauri::Builder::default()
        .setup(|app| {
            // Resolve the per-user data directory through Tauri so paths follow
            // XDG on Linux; nothing is ever written into the project folder.
            let data_dir = app.path().app_data_dir().map_err(|error| {
                AppError::internal(format!("could not resolve the app data directory: {error}"))
            })?;

            let db_path = db::database_path(&data_dir);

            tracing::info!(path = %db_path.display(), "opening database");

            // Blocking here is intentional and safe: it happens once, before any
            // window is shown, and the app cannot function without its database.
            // Doing it eagerly means no command has to handle "not ready yet".
            let db = tauri::async_runtime::block_on(db::connect(&db_path))?;

            app.manage(AppState::new(db));

            tracing::info!("core services ready");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::reset_settings,
            commands::profiles::list_profiles,
            commands::profiles::get_profile,
            commands::profiles::get_active_profile,
            commands::profiles::create_profile,
            commands::profiles::update_profile,
            commands::profiles::duplicate_profile,
            commands::profiles::delete_profile,
            commands::profiles::set_active_profile,
            commands::credentials::set_provider_credential,
            commands::credentials::get_credential_status,
            commands::credentials::list_credential_status,
            commands::credentials::delete_provider_credential,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
