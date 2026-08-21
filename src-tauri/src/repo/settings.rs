//! Settings repository.
//!
//! The whole settings document is stored as one JSON row in the `settings`
//! key/value table. Reads validate what they load, so a corrupt or
//! hand-edited value can never put the running app into an invalid state — it
//! falls back to defaults with a loud log line instead of refusing to start.

use crate::db::Db;
use crate::domain::common::now_timestamp;
use crate::domain::settings::{Settings, SettingsPatch, SETTINGS_KEY};
use crate::error::{AppError, AppResult};

/// Loads the settings document, or returns validated defaults when the app has
/// never been configured.
pub async fn load(db: &Db) -> AppResult<Settings> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?1")
        .bind(SETTINGS_KEY)
        .fetch_optional(db)
        .await?;

    let Some((raw,)) = row else {
        return Settings::default().validate();
    };

    // A stored document that no longer parses or validates must not brick the
    // app. Log the fact (never the contents — they can name devices and
    // endpoints) and continue from defaults.
    match serde_json::from_str::<Settings>(&raw) {
        Ok(settings) => match settings.validate() {
            Ok(valid) => Ok(valid),
            Err(error) => {
                tracing::warn!(
                    reason = %error,
                    "stored settings failed validation; falling back to defaults"
                );
                Settings::default().validate()
            }
        },
        Err(error) => {
            tracing::warn!(
                reason = %error,
                "stored settings could not be parsed; falling back to defaults"
            );
            Settings::default().validate()
        }
    }
}

/// Validates and writes the complete settings document.
pub async fn save(db: &Db, settings: Settings) -> AppResult<Settings> {
    let settings = settings.validate()?;

    let encoded = serde_json::to_string(&settings)
        .map_err(|error| AppError::internal(format!("could not encode settings: {error}")))?;

    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(SETTINGS_KEY)
    .bind(encoded)
    .bind(now_timestamp())
    .execute(db)
    .await?;

    Ok(settings)
}

/// Applies a partial update: load, merge, validate, write.
///
/// Runs in a transaction so a concurrent writer cannot interleave between the
/// read and the write and silently lose a field.
pub async fn patch(db: &Db, patch: SettingsPatch) -> AppResult<Settings> {
    let mut tx = db.begin().await?;

    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?1")
        .bind(SETTINGS_KEY)
        .fetch_optional(&mut *tx)
        .await?;

    let base = match row {
        Some((raw,)) => serde_json::from_str::<Settings>(&raw).unwrap_or_default(),
        None => Settings::default(),
    };

    let merged = patch.apply(base)?;

    let encoded = serde_json::to_string(&merged)
        .map_err(|error| AppError::internal(format!("could not encode settings: {error}")))?;

    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(SETTINGS_KEY)
    .bind(encoded)
    .bind(now_timestamp())
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(merged)
}

/// Clears the active profile if it points at `profile_id`.
///
/// Called when a profile is deleted so settings never reference a missing row.
/// (`settings` is a key/value blob, so no foreign key can do this for us.)
pub async fn clear_active_profile_if(db: &Db, profile_id: &str) -> AppResult<()> {
    let current = load(db).await?;

    if current.active_profile_id.as_deref() == Some(profile_id) {
        patch(db, SettingsPatch { active_profile_id: Some(None), ..Default::default() }).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connect_in_memory;
    use crate::domain::common::{AnswerLength, Mode, Theme};

    #[tokio::test]
    async fn loading_before_any_write_returns_defaults() {
        let db = connect_in_memory().await.expect("connect");
        let settings = load(&db).await.expect("load");

        assert_eq!(settings, Settings::default().validate().expect("valid defaults"));
    }

    #[tokio::test]
    async fn settings_round_trip_through_the_database() {
        let db = connect_in_memory().await.expect("connect");

        let saved = save(
            &db,
            Settings {
                default_mode: Mode::Coding,
                answer_length: AnswerLength::Detailed,
                response_delay_ms: 2_500,
                theme: Theme::Dark,
                ..Default::default()
            },
        )
        .await
        .expect("save");

        let loaded = load(&db).await.expect("load");
        assert_eq!(loaded, saved);
        assert_eq!(loaded.default_mode, Mode::Coding);
        assert_eq!(loaded.response_delay_ms, 2_500);
    }

    #[tokio::test]
    async fn saving_twice_updates_in_place_instead_of_inserting() {
        let db = connect_in_memory().await.expect("connect");

        save(&db, Settings::default()).await.expect("first save");
        save(&db, Settings { response_delay_ms: 3_000, ..Default::default() })
            .await
            .expect("second save");

        let rows: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM settings").fetch_one(&db).await.expect("count");

        assert_eq!(rows.0, 1, "the settings document must be a single row");
        assert_eq!(load(&db).await.expect("load").response_delay_ms, 3_000);
    }

    #[tokio::test]
    async fn a_patch_preserves_unrelated_fields() {
        let db = connect_in_memory().await.expect("connect");

        save(&db, Settings { response_delay_ms: 4_000, ..Default::default() }).await.expect("save");

        let patched = patch(
            &db,
            SettingsPatch { answer_length: Some(AnswerLength::Short), ..Default::default() },
        )
        .await
        .expect("patch");

        assert_eq!(patched.answer_length, AnswerLength::Short);
        assert_eq!(patched.response_delay_ms, 4_000);
        assert_eq!(load(&db).await.expect("load"), patched);
    }

    #[tokio::test]
    async fn an_invalid_patch_is_rejected_and_leaves_storage_untouched() {
        let db = connect_in_memory().await.expect("connect");
        let original = save(&db, Settings::default()).await.expect("save");

        let result =
            patch(&db, SettingsPatch { response_delay_ms: Some(999_999), ..Default::default() })
                .await;

        assert!(result.is_err());
        assert_eq!(load(&db).await.expect("load"), original, "rollback must leave the row intact");
    }

    #[tokio::test]
    async fn corrupt_stored_settings_degrade_to_defaults() {
        let db = connect_in_memory().await.expect("connect");

        sqlx::query("INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)")
            .bind(SETTINGS_KEY)
            .bind("{ this is not json")
            .bind(now_timestamp())
            .execute(&db)
            .await
            .expect("insert corrupt row");

        let settings = load(&db).await.expect("load must not fail");
        assert_eq!(settings, Settings::default().validate().expect("valid defaults"));
    }

    #[tokio::test]
    async fn stored_settings_that_violate_an_invariant_degrade_to_defaults() {
        let db = connect_in_memory().await.expect("connect");

        // Valid JSON, but a delay no UI could have produced (hand-edited row).
        sqlx::query("INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)")
            .bind(SETTINGS_KEY)
            .bind(r#"{"responseDelayMs":600000}"#)
            .bind(now_timestamp())
            .execute(&db)
            .await
            .expect("insert row");

        let settings = load(&db).await.expect("load must not fail");
        assert_eq!(settings.response_delay_ms, Settings::default().response_delay_ms);
    }

    #[tokio::test]
    async fn clearing_the_active_profile_only_affects_a_match() {
        let db = connect_in_memory().await.expect("connect");

        save(&db, Settings { active_profile_id: Some("p1".into()), ..Default::default() })
            .await
            .expect("save");

        clear_active_profile_if(&db, "p2").await.expect("no-op");
        assert_eq!(load(&db).await.expect("load").active_profile_id, Some("p1".into()));

        clear_active_profile_if(&db, "p1").await.expect("clear");
        assert_eq!(load(&db).await.expect("load").active_profile_id, None);
    }
}
