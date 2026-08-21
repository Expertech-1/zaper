//! Profile domain model — WHO the assistant answers as.
//!
//! Interview-specific context (company, job description, this-interview notes)
//! deliberately lives in a separate aggregate; see spec §8. Nothing here should
//! ever be mutated as a side effect of running an interview.

use serde::{Deserialize, Serialize};

use super::common::{decode_tags, new_id, normalize_tags, optional_text, require_text};
use crate::error::AppResult;

// Field limits. Generous for humans, bounded so a single profile cannot make
// every future prompt enormous.
const MAX_NAME: usize = 120;
const MAX_HEADLINE: usize = 200;
const MAX_SUMMARY: usize = 4_000;
const MAX_DESCRIPTION: usize = 4_000;
const MAX_STORY_FIELD: usize = 2_000;
const MAX_SHORT_TEXT: usize = 200;
const MAX_URL: usize = 500;
const MAX_TAGS: usize = 100;
const MAX_CHILDREN: usize = 100;

/// A complete profile with all of its children loaded.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub headline: Option<String>,
    pub summary: Option<String>,
    pub skills: Vec<String>,
    pub technologies: Vec<String>,
    pub achievements: Vec<String>,
    pub opinions: Vec<String>,
    pub experiences: Vec<Experience>,
    pub projects: Vec<Project>,
    pub stories: Vec<StarStory>,
    pub created_at: String,
    pub updated_at: String,
}

/// Lightweight row for the profile list — avoids loading every child entity
/// just to render a sidebar.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub id: String,
    pub name: String,
    pub headline: Option<String>,
    pub skill_count: usize,
    pub experience_count: i64,
    pub project_count: i64,
    pub story_count: i64,
    pub is_active: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Experience {
    pub id: String,
    pub company: String,
    pub role: String,
    pub description: Option<String>,
    /// Free-form so "2021", "2021-03" and "March 2021" are all acceptable;
    /// resumes are not ISO dates.
    pub start_date: Option<String>,
    /// `None` means "present".
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub technologies: Vec<String>,
    pub url: Option<String>,
}

/// A STAR story kept as four discrete fields so prompts can turn it into
/// natural speech instead of emitting literal "Situation:" labels (spec §6B).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StarStory {
    pub id: String,
    pub title: String,
    pub situation: String,
    pub task: String,
    pub action: String,
    pub result: String,
    pub tags: Vec<String>,
}

// ---------------------------------------------------------------------------
// Inputs — what the UI sends. Ids are absent/optional; the domain assigns them.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub name: String,
    #[serde(default)]
    pub headline: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub technologies: Vec<String>,
    #[serde(default)]
    pub achievements: Vec<String>,
    #[serde(default)]
    pub opinions: Vec<String>,
    #[serde(default)]
    pub experiences: Vec<ExperienceInput>,
    #[serde(default)]
    pub projects: Vec<ProjectInput>,
    #[serde(default)]
    pub stories: Vec<StarStoryInput>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExperienceInput {
    #[serde(default)]
    pub id: Option<String>,
    pub company: String,
    pub role: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub technologies: Vec<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StarStoryInput {
    #[serde(default)]
    pub id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub situation: String,
    #[serde(default)]
    pub task: String,
    #[serde(default)]
    pub action: String,
    #[serde(default)]
    pub result: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// A validated, normalized profile ready to be persisted.
///
/// The only way to construct one is [`ProfileInput::validate`], so a repository
/// cannot accidentally write unvalidated data.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedProfile {
    pub name: String,
    pub headline: Option<String>,
    pub summary: Option<String>,
    pub skills: Vec<String>,
    pub technologies: Vec<String>,
    pub achievements: Vec<String>,
    pub opinions: Vec<String>,
    pub experiences: Vec<Experience>,
    pub projects: Vec<Project>,
    pub stories: Vec<StarStory>,
}

impl ProfileInput {
    /// Applies every profile invariant, returning normalized data or a
    /// user-facing validation error.
    pub fn validate(self) -> AppResult<ValidatedProfile> {
        check_child_count("experiences", self.experiences.len())?;
        check_child_count("projects", self.projects.len())?;
        check_child_count("stories", self.stories.len())?;

        let experiences = self
            .experiences
            .into_iter()
            .map(ExperienceInput::validate)
            .collect::<AppResult<Vec<_>>>()?;

        let projects =
            self.projects.into_iter().map(ProjectInput::validate).collect::<AppResult<Vec<_>>>()?;

        let stories = self
            .stories
            .into_iter()
            .map(StarStoryInput::validate)
            .collect::<AppResult<Vec<_>>>()?;

        Ok(ValidatedProfile {
            name: require_text("Profile name", &self.name, MAX_NAME)?,
            headline: optional_text(self.headline, MAX_HEADLINE)?,
            summary: optional_text(self.summary, MAX_SUMMARY)?,
            skills: normalize_tags(self.skills, MAX_TAGS)?,
            technologies: normalize_tags(self.technologies, MAX_TAGS)?,
            achievements: normalize_tags(self.achievements, MAX_TAGS)?,
            opinions: normalize_tags(self.opinions, MAX_TAGS)?,
            experiences,
            projects,
            stories,
        })
    }
}

impl ExperienceInput {
    fn validate(self) -> AppResult<Experience> {
        Ok(Experience {
            id: self.id.unwrap_or_else(new_id),
            company: require_text("Company", &self.company, MAX_SHORT_TEXT)?,
            role: require_text("Role", &self.role, MAX_SHORT_TEXT)?,
            description: optional_text(self.description, MAX_DESCRIPTION)?,
            start_date: optional_text(self.start_date, 40)?,
            end_date: optional_text(self.end_date, 40)?,
        })
    }
}

impl ProjectInput {
    fn validate(self) -> AppResult<Project> {
        Ok(Project {
            id: self.id.unwrap_or_else(new_id),
            name: require_text("Project name", &self.name, MAX_SHORT_TEXT)?,
            description: optional_text(self.description, MAX_DESCRIPTION)?,
            technologies: normalize_tags(self.technologies, MAX_TAGS)?,
            url: optional_text(self.url, MAX_URL)?,
        })
    }
}

impl StarStoryInput {
    fn validate(self) -> AppResult<StarStory> {
        Ok(StarStory {
            id: self.id.unwrap_or_else(new_id),
            title: require_text("Story title", &self.title, MAX_SHORT_TEXT)?,
            situation: optional_text(Some(self.situation), MAX_STORY_FIELD)?.unwrap_or_default(),
            task: optional_text(Some(self.task), MAX_STORY_FIELD)?.unwrap_or_default(),
            action: optional_text(Some(self.action), MAX_STORY_FIELD)?.unwrap_or_default(),
            result: optional_text(Some(self.result), MAX_STORY_FIELD)?.unwrap_or_default(),
            tags: normalize_tags(self.tags, MAX_TAGS)?,
        })
    }
}

fn check_child_count(field: &'static str, count: usize) -> AppResult<()> {
    if count > MAX_CHILDREN {
        return Err(crate::error::AppError::validation(format!(
            "A profile can hold at most {MAX_CHILDREN} {field}."
        )));
    }
    Ok(())
}

impl Profile {
    /// Produces the input for a copy of this profile, with a distinct name and
    /// fresh child ids so the duplicate is fully independent.
    pub fn to_duplicate_input(&self, name_suffix: &str) -> ProfileInput {
        ProfileInput {
            name: truncate_name(&format!("{} {}", self.name, name_suffix)),
            headline: self.headline.clone(),
            summary: self.summary.clone(),
            skills: self.skills.clone(),
            technologies: self.technologies.clone(),
            achievements: self.achievements.clone(),
            opinions: self.opinions.clone(),
            experiences: self
                .experiences
                .iter()
                .map(|e| ExperienceInput {
                    id: None,
                    company: e.company.clone(),
                    role: e.role.clone(),
                    description: e.description.clone(),
                    start_date: e.start_date.clone(),
                    end_date: e.end_date.clone(),
                })
                .collect(),
            projects: self
                .projects
                .iter()
                .map(|p| ProjectInput {
                    id: None,
                    name: p.name.clone(),
                    description: p.description.clone(),
                    technologies: p.technologies.clone(),
                    url: p.url.clone(),
                })
                .collect(),
            stories: self
                .stories
                .iter()
                .map(|s| StarStoryInput {
                    id: None,
                    title: s.title.clone(),
                    situation: s.situation.clone(),
                    task: s.task.clone(),
                    action: s.action.clone(),
                    result: s.result.clone(),
                    tags: s.tags.clone(),
                })
                .collect(),
        }
    }

    /// Whether this profile has enough substance to ground an interview answer.
    /// Job mode uses this to warn instead of letting the model invent history.
    #[allow(dead_code, reason = "consumed by the context engine in M2")]
    pub fn has_groundable_experience(&self) -> bool {
        !self.experiences.is_empty() || !self.stories.is_empty() || !self.projects.is_empty()
    }
}

/// Keeps a generated name (e.g. after duplication) inside the column limit.
fn truncate_name(name: &str) -> String {
    if name.chars().count() <= MAX_NAME {
        return name.to_string();
    }
    name.chars().take(MAX_NAME).collect()
}

/// Decodes the JSON tag columns of a profile row.
pub(crate) fn decode_profile_tags(raw: &str) -> Vec<String> {
    decode_tags(raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::common::now_timestamp;
    use crate::error::ErrorKind;

    fn minimal_input(name: &str) -> ProfileInput {
        ProfileInput { name: name.to_string(), ..Default::default() }
    }

    /// Builds the aggregate the way the repository does after a write, so the
    /// domain tests can exercise methods that operate on a stored profile.
    fn stored(id: &str, input: ProfileInput) -> Profile {
        let validated = input.validate().expect("input should be valid");
        let timestamp = now_timestamp();

        Profile {
            id: id.to_string(),
            name: validated.name,
            headline: validated.headline,
            summary: validated.summary,
            skills: validated.skills,
            technologies: validated.technologies,
            achievements: validated.achievements,
            opinions: validated.opinions,
            experiences: validated.experiences,
            projects: validated.projects,
            stories: validated.stories,
            created_at: timestamp.clone(),
            updated_at: timestamp,
        }
    }

    #[test]
    fn a_name_is_required() {
        let error = minimal_input("   ").validate().expect_err("blank name must fail");
        assert_eq!(error.kind(), ErrorKind::Validation);
        assert!(error.user_message().contains("Profile name"));
    }

    #[test]
    fn text_fields_are_trimmed_and_blanks_become_none() {
        let validated = ProfileInput {
            name: "  Ada Lovelace  ".into(),
            headline: Some("   ".into()),
            summary: Some("  Systems engineer.  ".into()),
            ..Default::default()
        }
        .validate()
        .expect("valid");

        assert_eq!(validated.name, "Ada Lovelace");
        assert_eq!(validated.headline, None);
        assert_eq!(validated.summary.as_deref(), Some("Systems engineer."));
    }

    #[test]
    fn skills_are_deduplicated() {
        let validated = ProfileInput {
            name: "Ada".into(),
            skills: vec!["Rust".into(), "rust".into(), " Rust ".into(), "SQL".into()],
            ..Default::default()
        }
        .validate()
        .expect("valid");

        assert_eq!(validated.skills, vec!["Rust".to_string(), "SQL".to_string()]);
    }

    #[test]
    fn children_get_generated_ids_when_absent_and_keep_supplied_ones() {
        let validated = ProfileInput {
            name: "Ada".into(),
            experiences: vec![
                ExperienceInput {
                    id: None,
                    company: "Acme".into(),
                    role: "Engineer".into(),
                    ..Default::default()
                },
                ExperienceInput {
                    id: Some("fixed-id".into()),
                    company: "Globex".into(),
                    role: "Staff Engineer".into(),
                    ..Default::default()
                },
            ],
            ..Default::default()
        }
        .validate()
        .expect("valid");

        assert!(!validated.experiences[0].id.is_empty());
        assert_ne!(validated.experiences[0].id, "fixed-id");
        assert_eq!(validated.experiences[1].id, "fixed-id");
    }

    #[test]
    fn an_experience_requires_company_and_role() {
        let error = ProfileInput {
            name: "Ada".into(),
            experiences: vec![ExperienceInput {
                company: "Acme".into(),
                role: "  ".into(),
                ..Default::default()
            }],
            ..Default::default()
        }
        .validate()
        .expect_err("missing role must fail");

        assert!(error.user_message().contains("Role"));
    }

    #[test]
    fn oversized_child_collections_are_rejected() {
        let experiences = (0..(MAX_CHILDREN + 1))
            .map(|i| ExperienceInput {
                company: format!("Company {i}"),
                role: "Engineer".into(),
                ..Default::default()
            })
            .collect();

        let error = ProfileInput { name: "Ada".into(), experiences, ..Default::default() }
            .validate()
            .expect_err("too many experiences must fail");

        assert_eq!(error.kind(), ErrorKind::Validation);
    }

    #[test]
    fn duplicating_renames_and_regenerates_child_ids() {
        let original = stored(
            "p1",
            ProfileInput {
                name: "Ada".into(),
                experiences: vec![ExperienceInput {
                    company: "Acme".into(),
                    role: "Engineer".into(),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        let copy = original.to_duplicate_input("(copy)").validate().expect("valid copy");

        assert_eq!(copy.name, "Ada (copy)");
        assert_eq!(copy.experiences.len(), 1);
        assert_ne!(copy.experiences[0].id, original.experiences[0].id);
    }

    #[test]
    fn duplicate_names_stay_within_the_column_limit() {
        let long = "n".repeat(MAX_NAME);
        let original = stored("p1", minimal_input(&long));

        let copy = original.to_duplicate_input("(copy)");
        assert_eq!(copy.name.chars().count(), MAX_NAME);
    }

    #[test]
    fn groundability_requires_at_least_one_concrete_item() {
        let empty = stored("p1", minimal_input("Ada"));
        assert!(!empty.has_groundable_experience());

        let with_story = stored(
            "p2",
            ProfileInput {
                name: "Ada".into(),
                stories: vec![StarStoryInput {
                    title: "Shipped the migration".into(),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );
        assert!(with_story.has_groundable_experience());
    }
}
