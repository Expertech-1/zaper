use serde::Serialize;

/// Metadata about the running application, returned by the `get_app_info`
/// command. Mirrored in `src/types/ipc.ts` (`appInfoSchema`).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub environment: String,
    pub platform: String,
}

/// M0 "hello world" command that proves the React ↔ Rust bridge works.
#[tauri::command]
pub fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    let info = app.package_info();

    AppInfo {
        name: info.name.clone(),
        version: info.version.to_string(),
        environment: if cfg!(debug_assertions) {
            "development".to_string()
        } else {
            "production".to_string()
        },
        platform: std::env::consts::OS.to_string(),
    }
}
