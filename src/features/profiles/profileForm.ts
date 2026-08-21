/**
 * Editor state for a profile, and its mapping to the IPC payload.
 *
 * Kept separate from the components so the mapping is unit-testable without
 * rendering anything, and so the form does not become the place where domain
 * shape decisions live.
 *
 * Every field is a string in the editor (that is what an input holds); the
 * conversion to the domain's arrays and nullables happens once, in
 * `toProfileInput`.
 */

import { joinLines, joinTags, splitLines, splitTags, textOrNull } from "../../lib/lists";
import type { Profile, ProfileInput } from "../../types/ipc";

/** A child row being edited. `key` is React's list identity, `id` is the stored id. */
export interface ExperienceDraft {
  key: string;
  id?: string;
  company: string;
  role: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface ProjectDraft {
  key: string;
  id?: string;
  name: string;
  description: string;
  technologies: string;
  url: string;
}

export interface StoryDraft {
  key: string;
  id?: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string;
}

export interface ProfileFormState {
  name: string;
  headline: string;
  summary: string;
  skills: string;
  technologies: string;
  achievements: string;
  opinions: string;
  experiences: ExperienceDraft[];
  projects: ProjectDraft[];
  stories: StoryDraft[];
}

/** Stable-enough key for a newly added row; never sent to the backend. */
function draftKey(): string {
  return `draft-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyExperience(): ExperienceDraft {
  return { key: draftKey(), company: "", role: "", description: "", startDate: "", endDate: "" };
}

export function emptyProject(): ProjectDraft {
  return { key: draftKey(), name: "", description: "", technologies: "", url: "" };
}

export function emptyStory(): StoryDraft {
  return { key: draftKey(), title: "", situation: "", task: "", action: "", result: "", tags: "" };
}

/** Blank form, used by "New profile". */
export function emptyProfileForm(): ProfileFormState {
  return {
    name: "",
    headline: "",
    summary: "",
    skills: "",
    technologies: "",
    achievements: "",
    opinions: "",
    experiences: [],
    projects: [],
    stories: [],
  };
}

/** Loads a stored profile into editor state. */
export function profileToForm(profile: Profile): ProfileFormState {
  return {
    name: profile.name,
    headline: profile.headline ?? "",
    summary: profile.summary ?? "",
    skills: joinTags(profile.skills),
    technologies: joinTags(profile.technologies),
    achievements: joinLines(profile.achievements),
    opinions: joinLines(profile.opinions),
    experiences: profile.experiences.map((experience) => ({
      key: experience.id,
      id: experience.id,
      company: experience.company,
      role: experience.role,
      description: experience.description ?? "",
      startDate: experience.startDate ?? "",
      endDate: experience.endDate ?? "",
    })),
    projects: profile.projects.map((project) => ({
      key: project.id,
      id: project.id,
      name: project.name,
      description: project.description ?? "",
      technologies: joinTags(project.technologies),
      url: project.url ?? "",
    })),
    stories: profile.stories.map((story) => ({
      key: story.id,
      id: story.id,
      title: story.title,
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
      tags: joinTags(story.tags),
    })),
  };
}

/**
 * Converts editor state into the command payload.
 *
 * Completely empty child rows are dropped rather than rejected: adding a row and
 * changing your mind should not turn into a validation error.
 */
export function toProfileInput(form: ProfileFormState): ProfileInput {
  return {
    name: form.name.trim(),
    headline: textOrNull(form.headline),
    summary: textOrNull(form.summary),
    skills: splitTags(form.skills),
    technologies: splitTags(form.technologies),
    achievements: splitLines(form.achievements),
    opinions: splitLines(form.opinions),
    experiences: form.experiences.filter(isMeaningfulExperience).map((experience) => ({
      id: experience.id,
      company: experience.company.trim(),
      role: experience.role.trim(),
      description: textOrNull(experience.description),
      startDate: textOrNull(experience.startDate),
      endDate: textOrNull(experience.endDate),
    })),
    projects: form.projects.filter(isMeaningfulProject).map((project) => ({
      id: project.id,
      name: project.name.trim(),
      description: textOrNull(project.description),
      technologies: splitTags(project.technologies),
      url: textOrNull(project.url),
    })),
    stories: form.stories.filter(isMeaningfulStory).map((story) => ({
      id: story.id,
      title: story.title.trim(),
      situation: story.situation.trim(),
      task: story.task.trim(),
      action: story.action.trim(),
      result: story.result.trim(),
      tags: splitTags(story.tags),
    })),
  };
}

function isMeaningfulExperience(experience: ExperienceDraft): boolean {
  return Boolean(
    experience.company.trim() ||
    experience.role.trim() ||
    experience.description.trim() ||
    experience.startDate.trim() ||
    experience.endDate.trim(),
  );
}

function isMeaningfulProject(project: ProjectDraft): boolean {
  return Boolean(
    project.name.trim() ||
    project.description.trim() ||
    project.technologies.trim() ||
    project.url.trim(),
  );
}

function isMeaningfulStory(story: StoryDraft): boolean {
  return Boolean(
    story.title.trim() ||
    story.situation.trim() ||
    story.task.trim() ||
    story.action.trim() ||
    story.result.trim() ||
    story.tags.trim(),
  );
}
