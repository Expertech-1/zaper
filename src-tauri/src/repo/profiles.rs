//! Profile repository.
//!
//! A profile is an aggregate: the `profiles` row plus its experiences, projects
//! and stories. Every write replaces the children inside a single transaction,
//! so a partially saved profile is not observable.

use sqlx::Row;

use crate::db::Db;
use crate::domain::common::{encode_tags, new_id, now_timestamp};
use crate::domain::profile::{
    decode_profile_tags, Experience, Profile, ProfileInput, ProfileSummary, Project, StarStory,
    ValidatedProfile,
};
use crate::error::{AppError, AppResult};
use crate::repo::settings as settings_repo;

/// Suffix appended when duplicating a profile.
const DUPLICATE_SUFFIX: &str = "(copy)";

/// Lists profiles with their child counts, newest activity first.
///
/// Counts come from correlated subqueries rather than three extra round trips,
/// and the whole list is one statement so the UI renders in a single await.
pub async fn list(db: &Db) -> AppResult<Vec<ProfileSummary>> {
    let active_profile_id = settings_repo::load(db).await?.active_profile_id;

    let rows = sqlx::query(
        "SELECT
             p.id,
             p.name,
             p.headline,
             p.skills,
             (SELECT COUNT(*) FROM profile_experiences e WHERE e.profile_id = p.id) AS experiences,
             (SELECT COUNT(*) FROM profile_projects   r WHERE r.profile_id = p.id) AS projects,
             (SELECT COUNT(*) FROM profile_stories    s WHERE s.profile_id = p.id) AS stories,
             p.updated_at
         FROM profiles p
         ORDER BY p.updated_at DESC",
    )
    .fetch_all(db)
    .await?;

    let summaries = rows
        .into_iter()
        .map(|row| {
            let id: String = row.get("id");
            let skills: String = row.get("skills");

            ProfileSummary {
                is_active: active_profile_id.as_deref() == Some(id.as_str()),
                name: row.get("name"),
                headline: row.get("headline"),
                skill_count: decode_profile_tags(&skills).len(),
                experience_count: row.get("experiences"),
                project_count: row.get("projects"),
                story_count: row.get("stories"),
                updated_at: row.get("updated_at"),
                id,
            }
        })
        .collect();

    Ok(summaries)
}

/// Loads one complete profile, or `None` when it does not exist.
pub async fn find(db: &Db, id: &str) -> AppResult<Option<Profile>> {
    let Some(row) = sqlx::query(
        "SELECT id, name, headline, summary, skills, technologies, achievements, opinions,
                created_at, updated_at
         FROM profiles WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(db)
    .await?
    else {
        return Ok(None);
    };

    let skills: String = row.get("skills");
    let technologies: String = row.get("technologies");
    let achievements: String = row.get("achievements");
    let opinions: String = row.get("opinions");

    Ok(Some(Profile {
        id: row.get("id"),
        name: row.get("name"),
        headline: row.get("headline"),
        summary: row.get("summary"),
        skills: decode_profile_tags(&skills),
        technologies: decode_profile_tags(&technologies),
        achievements: decode_profile_tags(&achievements),
        opinions: decode_profile_tags(&opinions),
        experiences: load_experiences(db, id).await?,
        projects: load_projects(db, id).await?,
        stories: load_stories(db, id).await?,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

/// Loads a profile or fails with a `NotFound` error.
pub async fn get(db: &Db, id: &str) -> AppResult<Profile> {
    find(db, id).await?.ok_or_else(|| AppError::not_found("profile", id))
}

/// Creates a profile from validated input and returns the stored aggregate.
pub async fn create(db: &Db, input: ProfileInput) -> AppResult<Profile> {
    let validated = input.validate()?;
    let id = new_id();
    let timestamp = now_timestamp();

    let mut tx = db.begin().await?;

    sqlx::query(
        "INSERT INTO profiles
             (id, name, headline, summary, skills, technologies, achievements, opinions,
              created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
    )
    .bind(&id)
    .bind(&validated.name)
    .bind(&validated.headline)
    .bind(&validated.summary)
    .bind(encode_tags(&validated.skills))
    .bind(encode_tags(&validated.technologies))
    .bind(encode_tags(&validated.achievements))
    .bind(encode_tags(&validated.opinions))
    .bind(&timestamp)
    .execute(&mut *tx)
    .await?;

    write_children(&mut tx, &id, &validated).await?;

    tx.commit().await?;

    tracing::info!(profile_id = %id, "profile created");

    get(db, &id).await
}

/// Replaces an existing profile with validated input.
pub async fn update(db: &Db, id: &str, input: ProfileInput) -> AppResult<Profile> {
    let validated = input.validate()?;
    let timestamp = now_timestamp();

    let mut tx = db.begin().await?;

    let result = sqlx::query(
        "UPDATE profiles
         SET name = ?2, headline = ?3, summary = ?4, skills = ?5, technologies = ?6,
             achievements = ?7, opinions = ?8, updated_at = ?9
         WHERE id = ?1",
    )
    .bind(id)
    .bind(&validated.name)
    .bind(&validated.headline)
    .bind(&validated.summary)
    .bind(encode_tags(&validated.skills))
    .bind(encode_tags(&validated.technologies))
    .bind(encode_tags(&validated.achievements))
    .bind(encode_tags(&validated.opinions))
    .bind(&timestamp)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        // Roll back rather than leaving a transaction open on the pooled
        // connection, then report the missing row.
        tx.rollback().await?;
        return Err(AppError::not_found("profile", id));
    }

    // Children are replaced wholesale: the UI edits the collection as a unit, so
    // diffing rows would add complexity without changing the observable result.
    sqlx::query("DELETE FROM profile_experiences WHERE profile_id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM profile_projects WHERE profile_id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM profile_stories WHERE profile_id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    write_children(&mut tx, id, &validated).await?;

    tx.commit().await?;

    tracing::info!(profile_id = %id, "profile updated");

    get(db, id).await
}

/// Copies a profile, including children, under a new name and fresh ids.
pub async fn duplicate(db: &Db, id: &str) -> AppResult<Profile> {
    let existing = get(db, id).await?;
    create(db, existing.to_duplicate_input(DUPLICATE_SUFFIX)).await
}

/// Deletes a profile. Children cascade; the active-profile setting is cleared
/// if it pointed here, because a key/value blob has no foreign key to do it.
pub async fn delete(db: &Db, id: &str) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM profiles WHERE id = ?1").bind(id).execute(db).await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("profile", id));
    }

    settings_repo::clear_active_profile_if(db, id).await?;

    tracing::info!(profile_id = %id, "profile deleted");

    Ok(())
}

/// Marks a profile active, verifying it exists first so settings cannot end up
/// pointing at a deleted row.
pub async fn set_active(db: &Db, id: &str) -> AppResult<Profile> {
    let profile = get(db, id).await?;

    settings_repo::patch(
        db,
        crate::domain::settings::SettingsPatch {
            active_profile_id: Some(Some(profile.id.clone())),
            ..Default::default()
        },
    )
    .await?;

    Ok(profile)
}

/// Returns the active profile, or `None` when none is selected (or the selected
/// one has since disappeared).
pub async fn active(db: &Db) -> AppResult<Option<Profile>> {
    let Some(id) = settings_repo::load(db).await?.active_profile_id else {
        return Ok(None);
    };

    find(db, &id).await
}

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

type Tx<'a> = sqlx::Transaction<'a, sqlx::Sqlite>;

/// Inserts the child rows of a profile. `position` preserves the user's
/// ordering, which is meaningful on a CV.
async fn write_children(
    tx: &mut Tx<'_>,
    profile_id: &str,
    profile: &ValidatedProfile,
) -> AppResult<()> {
    for (position, experience) in profile.experiences.iter().enumerate() {
        sqlx::query(
            "INSERT INTO profile_experiences
                 (id, profile_id, company, role, description, start_date, end_date, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .bind(&experience.id)
        .bind(profile_id)
        .bind(&experience.company)
        .bind(&experience.role)
        .bind(&experience.description)
        .bind(&experience.start_date)
        .bind(&experience.end_date)
        .bind(position as i64)
        .execute(&mut **tx)
        .await?;
    }

    for (position, project) in profile.projects.iter().enumerate() {
        sqlx::query(
            "INSERT INTO profile_projects
                 (id, profile_id, name, description, technologies, url, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .bind(&project.id)
        .bind(profile_id)
        .bind(&project.name)
        .bind(&project.description)
        .bind(encode_tags(&project.technologies))
        .bind(&project.url)
        .bind(position as i64)
        .execute(&mut **tx)
        .await?;
    }

    for (position, story) in profile.stories.iter().enumerate() {
        sqlx::query(
            "INSERT INTO profile_stories
                 (id, profile_id, title, situation, task, action, result, tags, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )
        .bind(&story.id)
        .bind(profile_id)
        .bind(&story.title)
        .bind(&story.situation)
        .bind(&story.task)
        .bind(&story.action)
        .bind(&story.result)
        .bind(encode_tags(&story.tags))
        .bind(position as i64)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn load_experiences(db: &Db, profile_id: &str) -> AppResult<Vec<Experience>> {
    let rows = sqlx::query(
        "SELECT id, company, role, description, start_date, end_date
         FROM profile_experiences WHERE profile_id = ?1 ORDER BY position ASC",
    )
    .bind(profile_id)
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| Experience {
            id: row.get("id"),
            company: row.get("company"),
            role: row.get("role"),
            description: row.get("description"),
            start_date: row.get("start_date"),
            end_date: row.get("end_date"),
        })
        .collect())
}

async fn load_projects(db: &Db, profile_id: &str) -> AppResult<Vec<Project>> {
    let rows = sqlx::query(
        "SELECT id, name, description, technologies, url
         FROM profile_projects WHERE profile_id = ?1 ORDER BY position ASC",
    )
    .bind(profile_id)
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let technologies: String = row.get("technologies");
            Project {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                technologies: decode_profile_tags(&technologies),
                url: row.get("url"),
            }
        })
        .collect())
}

async fn load_stories(db: &Db, profile_id: &str) -> AppResult<Vec<StarStory>> {
    let rows = sqlx::query(
        "SELECT id, title, situation, task, action, result, tags
         FROM profile_stories WHERE profile_id = ?1 ORDER BY position ASC",
    )
    .bind(profile_id)
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let tags: String = row.get("tags");
            StarStory {
                id: row.get("id"),
                title: row.get("title"),
                situation: row.get("situation"),
                task: row.get("task"),
                action: row.get("action"),
                result: row.get("result"),
                tags: decode_profile_tags(&tags),
            }
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connect_in_memory;
    use crate::domain::profile::{ExperienceInput, ProjectInput, StarStoryInput};
    use crate::error::ErrorKind;

    fn full_input(name: &str) -> ProfileInput {
        ProfileInput {
            name: name.to_string(),
            headline: Some("Senior Engineer".into()),
            summary: Some("Builds Linux desktop software.".into()),
            skills: vec!["Rust".into(), "TypeScript".into()],
            technologies: vec!["Tauri".into(), "SQLite".into()],
            achievements: vec!["Shipped Zaper".into()],
            opinions: vec!["Prefer boring technology.".into()],
            experiences: vec![
                ExperienceInput {
                    company: "Acme".into(),
                    role: "Staff Engineer".into(),
                    description: Some("Led the audio pipeline.".into()),
                    start_date: Some("2022".into()),
                    end_date: None,
                    id: None,
                },
                ExperienceInput {
                    company: "Globex".into(),
                    role: "Engineer".into(),
                    ..Default::default()
                },
            ],
            projects: vec![ProjectInput {
                name: "Zaper".into(),
                description: Some("Desktop copilot.".into()),
                technologies: vec!["Rust".into()],
                url: Some("https://example.com".into()),
                id: None,
            }],
            stories: vec![StarStoryInput {
                title: "Cut latency in half".into(),
                situation: "Answers took four seconds.".into(),
                task: "Reduce time to first token.".into(),
                action: "Streamed tokens and pre-warmed the pipeline.".into(),
                result: "Latency dropped to under two seconds.".into(),
                tags: vec!["performance".into()],
                id: None,
            }],
        }
    }

    #[tokio::test]
    async fn a_created_profile_round_trips_with_all_children() {
        let db = connect_in_memory().await.expect("connect");
        let created = create(&db, full_input("Ada Lovelace")).await.expect("create");

        let loaded = get(&db, &created.id).await.expect("get");

        assert_eq!(loaded, created);
        assert_eq!(loaded.name, "Ada Lovelace");
        assert_eq!(loaded.skills, vec!["Rust".to_string(), "TypeScript".to_string()]);
        assert_eq!(loaded.experiences.len(), 2);
        assert_eq!(loaded.projects.len(), 1);
        assert_eq!(loaded.stories.len(), 1);
        assert_eq!(loaded.stories[0].tags, vec!["performance".to_string()]);
    }

    #[tokio::test]
    async fn child_ordering_is_preserved() {
        let db = connect_in_memory().await.expect("connect");
        let created = create(&db, full_input("Ada")).await.expect("create");

        assert_eq!(created.experiences[0].company, "Acme");
        assert_eq!(created.experiences[1].company, "Globex");
    }

    #[tokio::test]
    async fn creating_with_invalid_input_writes_nothing() {
        let db = connect_in_memory().await.expect("connect");

        let error = create(&db, ProfileInput { name: "  ".into(), ..Default::default() })
            .await
            .expect_err("blank name must fail");

        assert_eq!(error.kind(), ErrorKind::Validation);
        assert!(list(&db).await.expect("list").is_empty());
    }

    #[tokio::test]
    async fn updating_replaces_children_atomically() {
        let db = connect_in_memory().await.expect("connect");
        let created = create(&db, full_input("Ada")).await.expect("create");

        let updated = update(
            &db,
            &created.id,
            ProfileInput {
                name: "Ada L.".into(),
                experiences: vec![ExperienceInput {
                    company: "Initech".into(),
                    role: "Principal".into(),
                    ..Default::default()
                }],
                ..Default::default()
            },
        )
        .await
        .expect("update");

        assert_eq!(updated.id, created.id, "identity must be stable across updates");
        assert_eq!(updated.name, "Ada L.");
        assert_eq!(updated.experiences.len(), 1);
        assert_eq!(updated.experiences[0].company, "Initech");
        assert!(updated.projects.is_empty(), "omitted children are removed");
        assert_eq!(updated.created_at, created.created_at, "created_at must not drift");
    }

    #[tokio::test]
    async fn a_rejected_update_leaves_the_stored_profile_intact() {
        let db = connect_in_memory().await.expect("connect");
        let created = create(&db, full_input("Ada")).await.expect("create");

        let result =
            update(&db, &created.id, ProfileInput { name: String::new(), ..Default::default() })
                .await;

        assert!(result.is_err());
        assert_eq!(get(&db, &created.id).await.expect("get"), created);
    }

    #[tokio::test]
    async fn updating_a_missing_profile_reports_not_found() {
        let db = connect_in_memory().await.expect("connect");

        let error = update(&db, "nope", full_input("Ada")).await.expect_err("must fail");
        assert_eq!(error.kind(), ErrorKind::NotFound);
    }

    #[tokio::test]
    async fn duplicating_produces_an_independent_copy() {
        let db = connect_in_memory().await.expect("connect");
        let original = create(&db, full_input("Ada")).await.expect("create");

        let copy = duplicate(&db, &original.id).await.expect("duplicate");

        assert_ne!(copy.id, original.id);
        assert_eq!(copy.name, "Ada (copy)");
        assert_eq!(copy.experiences.len(), original.experiences.len());
        assert_ne!(copy.experiences[0].id, original.experiences[0].id);

        // Editing the copy must not touch the original.
        update(&db, &copy.id, ProfileInput { name: "Changed".into(), ..Default::default() })
            .await
            .expect("update copy");

        assert_eq!(get(&db, &original.id).await.expect("get").name, "Ada");
    }

    #[tokio::test]
    async fn deleting_removes_children_and_clears_the_active_selection() {
        let db = connect_in_memory().await.expect("connect");
        let created = create(&db, full_input("Ada")).await.expect("create");

        set_active(&db, &created.id).await.expect("activate");
        assert_eq!(
            settings_repo::load(&db).await.expect("settings").active_profile_id,
            Some(created.id.clone())
        );

        delete(&db, &created.id).await.expect("delete");

        assert!(find(&db, &created.id).await.expect("find").is_none());
        assert_eq!(settings_repo::load(&db).await.expect("settings").active_profile_id, None);

        let orphans: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM profile_experiences")
            .fetch_one(&db)
            .await
            .expect("count");
        assert_eq!(orphans.0, 0);
    }

    #[tokio::test]
    async fn deleting_a_missing_profile_reports_not_found() {
        let db = connect_in_memory().await.expect("connect");
        let error = delete(&db, "nope").await.expect_err("must fail");
        assert_eq!(error.kind(), ErrorKind::NotFound);
    }

    #[tokio::test]
    async fn activating_a_missing_profile_does_not_change_settings() {
        let db = connect_in_memory().await.expect("connect");

        let error = set_active(&db, "nope").await.expect_err("must fail");
        assert_eq!(error.kind(), ErrorKind::NotFound);
        assert_eq!(settings_repo::load(&db).await.expect("settings").active_profile_id, None);
    }

    #[tokio::test]
    async fn the_list_carries_child_counts_and_the_active_flag() {
        let db = connect_in_memory().await.expect("connect");
        let first = create(&db, full_input("Ada")).await.expect("create");
        create(&db, ProfileInput { name: "Grace".into(), ..Default::default() })
            .await
            .expect("create");

        set_active(&db, &first.id).await.expect("activate");

        let summaries = list(&db).await.expect("list");
        assert_eq!(summaries.len(), 2);

        let ada = summaries.iter().find(|s| s.id == first.id).expect("Ada present");
        assert_eq!(ada.experience_count, 2);
        assert_eq!(ada.project_count, 1);
        assert_eq!(ada.story_count, 1);
        assert_eq!(ada.skill_count, 2);
        assert!(ada.is_active);

        let grace = summaries.iter().find(|s| s.name == "Grace").expect("Grace present");
        assert_eq!(grace.experience_count, 0);
        assert!(!grace.is_active);
    }

    #[tokio::test]
    async fn the_list_is_ordered_by_most_recent_activity() {
        let db = connect_in_memory().await.expect("connect");

        let first = create(&db, ProfileInput { name: "First".into(), ..Default::default() })
            .await
            .expect("create");
        // Timestamps are millisecond-resolution strings; make the ordering
        // deterministic rather than relying on execution speed.
        tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        create(&db, ProfileInput { name: "Second".into(), ..Default::default() })
            .await
            .expect("create");

        assert_eq!(list(&db).await.expect("list")[0].name, "Second");

        tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        update(&db, &first.id, ProfileInput { name: "First".into(), ..Default::default() })
            .await
            .expect("touch first");

        assert_eq!(list(&db).await.expect("list")[0].name, "First");
    }

    #[tokio::test]
    async fn the_active_profile_helper_tolerates_a_stale_reference() {
        let db = connect_in_memory().await.expect("connect");
        assert!(active(&db).await.expect("active").is_none());

        let created = create(&db, full_input("Ada")).await.expect("create");
        set_active(&db, &created.id).await.expect("activate");
        assert_eq!(active(&db).await.expect("active").map(|p| p.id), Some(created.id.clone()));

        // Simulate a stale pointer (e.g. a row removed outside the app).
        sqlx::query("DELETE FROM profiles WHERE id = ?1")
            .bind(&created.id)
            .execute(&db)
            .await
            .expect("delete row");

        assert!(active(&db).await.expect("active must not error").is_none());
    }
}
