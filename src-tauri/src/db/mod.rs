//! SQLite connection management and migrations.
//!
//! # Where data lives
//!
//! Nothing is written into the project directory. Paths come from Tauri's
//! path resolver, which follows the XDG spec on Linux:
//!
//! ```text
//! ~/.local/share/dev.zaper.app/   database, imported documents
//! ~/.cache/dev.zaper.app/         temporary files (safe to delete)
//! ~/.local/state/dev.zaper.app/   logs
//! ```
//!
//! # Why the runtime query API instead of `sqlx::query!`
//!
//! The compile-time-checked macros need a live database (or a committed
//! `.sqlx` offline cache) during `cargo build`. That makes clean builds and CI
//! fragile for a desktop app whose database is created at first launch, so we
//! use `sqlx::query`/`query_as` and cover the SQL with integration tests
//! against a real in-memory database instead.

use std::path::{Path, PathBuf};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::{Pool, Sqlite};

use crate::error::{AppError, AppResult};

/// Shared connection pool. Cloning is cheap — it is an `Arc` internally.
pub type Db = Pool<Sqlite>;

/// Embedded, versioned migrations from `src-tauri/migrations`.
/// Compiled into the binary, so a packaged `.deb` needs no extra files.
static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

/// Database file name inside the app data directory.
pub const DB_FILE_NAME: &str = "zaper.db";

/// SQLite allows one writer at a time. A small pool keeps memory low while
/// still letting concurrent readers (UI queries) proceed during a write.
const MAX_CONNECTIONS: u32 = 5;

/// Opens (creating if necessary) the database at `path`, applies pending
/// migrations, and returns a ready pool.
///
/// `path` may be `:memory:` for tests.
pub async fn connect(path: &Path) -> AppResult<Db> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            tokio::fs::create_dir_all(parent).await?;
        }
    }

    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        // Enforce the schema's ON DELETE CASCADE / REFERENCES clauses. SQLite
        // ignores foreign keys unless this is set on every connection.
        .foreign_keys(true)
        // WAL lets readers continue during writes — important because the UI
        // reads while the audio/meeting pipeline writes.
        .journal_mode(SqliteJournalMode::Wal)
        // NORMAL is the standard WAL pairing: durable across app crashes,
        // trading only a tiny window on OS-level power loss for far less fsync.
        .synchronous(SqliteSynchronous::Normal)
        // Fail fast instead of hanging the UI if another writer holds the lock.
        .busy_timeout(std::time::Duration::from_secs(5));

    open_pool(options).await
}

/// Opens a private in-memory database with migrations applied. Test-only helper.
#[cfg(test)]
pub async fn connect_in_memory() -> AppResult<Db> {
    let options = SqliteConnectOptions::new().filename(":memory:").foreign_keys(true);

    // An in-memory database vanishes when its last connection closes, so the
    // pool is pinned to a single long-lived connection.
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(AppError::Database)?;

    MIGRATOR.run(&pool).await?;
    Ok(pool)
}

async fn open_pool(options: SqliteConnectOptions) -> AppResult<Db> {
    let pool = SqlitePoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .connect_with(options)
        .await
        .map_err(AppError::Database)?;

    MIGRATOR.run(&pool).await?;

    tracing::info!(migrations = MIGRATOR.iter().len(), "database ready");
    Ok(pool)
}

/// Resolves the database path inside the Tauri-provided app data directory.
pub fn database_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(DB_FILE_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn migrations_apply_to_a_fresh_database() {
        let db = connect_in_memory().await.expect("connect");

        let tables: Vec<(String,)> =
            sqlx::query_as("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
                .fetch_all(&db)
                .await
                .expect("query tables");

        let names: Vec<String> = tables.into_iter().map(|(name,)| name).collect();

        for expected in [
            "ai_usage",
            "app_events",
            "conversation_messages",
            "conversations",
            "document_chunks",
            "documents",
            "interview_documents",
            "interviews",
            "meeting_action_items",
            "meeting_segments",
            "meetings",
            "profile_experiences",
            "profile_projects",
            "profile_stories",
            "profiles",
            "settings",
        ] {
            assert!(names.iter().any(|n| n == expected), "missing table `{expected}`");
        }
    }

    #[tokio::test]
    async fn foreign_keys_are_enforced() {
        let db = connect_in_memory().await.expect("connect");

        let result = sqlx::query(
            "INSERT INTO profile_experiences (id, profile_id, company, role)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind("exp-1")
        .bind("profile-that-does-not-exist")
        .bind("Acme")
        .bind("Engineer")
        .execute(&db)
        .await;

        assert!(result.is_err(), "orphan child row should be rejected");
    }

    #[tokio::test]
    async fn enum_check_constraints_reject_bad_values() {
        let db = connect_in_memory().await.expect("connect");

        let result = sqlx::query(
            "INSERT INTO interviews (id, title, mode, created_at, updated_at)
             VALUES ('i1', 'Test', 'not-a-mode', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        )
        .execute(&db)
        .await;

        assert!(result.is_err(), "invalid mode should violate the CHECK constraint");
    }

    #[tokio::test]
    async fn deleting_a_profile_cascades_to_its_children() {
        let db = connect_in_memory().await.expect("connect");

        sqlx::query(
            "INSERT INTO profiles (id, name, created_at, updated_at)
             VALUES ('p1', 'Test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        )
        .execute(&db)
        .await
        .expect("insert profile");

        sqlx::query(
            "INSERT INTO profile_projects (id, profile_id, name) VALUES ('pr1', 'p1', 'Zaper')",
        )
        .execute(&db)
        .await
        .expect("insert project");

        sqlx::query("DELETE FROM profiles WHERE id = 'p1'")
            .execute(&db)
            .await
            .expect("delete profile");

        let remaining: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM profile_projects")
            .fetch_one(&db)
            .await
            .expect("count projects");

        assert_eq!(remaining.0, 0, "children should be cascade-deleted");
    }

    #[test]
    fn database_path_lives_under_the_app_data_dir() {
        let path = database_path(Path::new("/home/user/.local/share/dev.zaper.app"));
        assert_eq!(path, Path::new("/home/user/.local/share/dev.zaper.app/zaper.db"));
    }

    // The tests above use an in-memory database. These exercise the real
    // production path — an on-disk file, WAL mode, directory creation — because
    // that is where first-launch bugs actually live.

    #[tokio::test]
    async fn connecting_creates_the_data_directory_and_the_database_file() {
        let temp = tempfile::tempdir().expect("temp dir");
        // Deliberately nested: on first launch the app data directory does not
        // exist yet.
        let path = temp.path().join("nested").join("dev.zaper.app").join(DB_FILE_NAME);

        let db = connect(&path).await.expect("connect");
        db.close().await;

        assert!(path.exists(), "the database file should have been created");
    }

    #[tokio::test]
    async fn reconnecting_reapplies_nothing_and_keeps_the_data() {
        let temp = tempfile::tempdir().expect("temp dir");
        let path = database_path(temp.path());

        let db = connect(&path).await.expect("first connect");
        sqlx::query(
            "INSERT INTO profiles (id, name, created_at, updated_at)
             VALUES ('p1', 'Ada', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        )
        .execute(&db)
        .await
        .expect("insert");
        db.close().await;

        // Migrations must be idempotent: a second launch reruns `connect`.
        let db = connect(&path).await.expect("second connect");
        let stored: (String,) = sqlx::query_as("SELECT name FROM profiles WHERE id = 'p1'")
            .fetch_one(&db)
            .await
            .expect("read back");
        db.close().await;

        assert_eq!(stored.0, "Ada");
    }

    #[tokio::test]
    async fn on_disk_databases_use_wal_and_enforce_foreign_keys() {
        let temp = tempfile::tempdir().expect("temp dir");
        let db = connect(&database_path(temp.path())).await.expect("connect");

        let (journal_mode,): (String,) =
            sqlx::query_as("PRAGMA journal_mode").fetch_one(&db).await.expect("pragma");
        let (foreign_keys,): (i64,) =
            sqlx::query_as("PRAGMA foreign_keys").fetch_one(&db).await.expect("pragma");

        db.close().await;

        assert_eq!(journal_mode.to_lowercase(), "wal");
        assert_eq!(foreign_keys, 1, "foreign keys must be on for every connection");
    }
}
