/**
 * In-memory stand-in for the Rust core, used ONLY when no Tauri runtime is
 * present: `pnpm dev` in a plain browser, and component tests.
 *
 * Why this exists: the UI should be developable and testable without compiling
 * Rust, and without every component growing an "if there is no backend" branch.
 *
 * What this is NOT: a second implementation of the domain. Rust owns validation,
 * persistence and every invariant. This module reproduces only the handful of
 * user-visible rules whose absence would make the preview misleading (a required
 * profile name, the response-delay ceiling), and it says so at each site. State
 * lives in module memory and disappears on reload — there is no persistence
 * here on purpose, so nobody mistakes the preview for the real app.
 */

import {
  MAX_RESPONSE_DELAY_MS,
  type AppInfo,
  type CommandName,
  type CredentialStatus,
  type Profile,
  type ProfileInput,
  type ProfileSummary,
  type ProviderKind,
  type Settings,
  type SettingsPatch,
} from "../types/ipc";
import type { IpcErrorPayload } from "../types/ipc";

/** Commands the preview backend can answer. */
const DEV_COMMANDS = [
  "get_app_info",
  "get_settings",
  "update_settings",
  "reset_settings",
  "list_profiles",
  "get_profile",
  "get_active_profile",
  "create_profile",
  "update_profile",
  "duplicate_profile",
  "delete_profile",
  "set_active_profile",
  "set_provider_credential",
  "get_credential_status",
  "list_credential_status",
  "delete_provider_credential",
] as const satisfies readonly CommandName[];

type DevCommand = (typeof DEV_COMMANDS)[number];

export function isDevCommand(command: CommandName): command is DevCommand {
  return (DEV_COMMANDS as readonly string[]).includes(command);
}

// ---------------------------------------------------------------------------
// Defaults — must match `Settings::default()` in `domain/settings.rs`.
// ---------------------------------------------------------------------------

function defaultProviderConfig() {
  return {
    provider: "mock" as ProviderKind,
    model: "",
    endpoint: null,
    timeoutSecs: 60,
    temperature: null,
    maxOutputTokens: null,
  };
}

function defaultSettings(): Settings {
  return {
    schemaVersion: 1,
    activeProfileId: null,
    defaultMode: "research",
    answerLength: "medium",
    responseDelayMs: 1_500,
    language: "auto",
    theme: "system",
    diagnosticLogging: false,
    onboardingCompleted: false,
    providers: {
      llm: defaultProviderConfig(),
      stt: defaultProviderConfig(),
      tts: defaultProviderConfig(),
      vision: defaultProviderConfig(),
    },
    tts: { enabled: false, voice: null, speed: 1, volume: 0.8 },
    audio: {
      microphoneDevice: null,
      systemAudioSource: null,
      captureMicrophone: true,
      captureSystemAudio: true,
    },
    shortcuts: {
      toggleAssistant: "Ctrl+Space",
      readScreen: "Ctrl+Shift+S",
      toggleMeeting: "Ctrl+Shift+M",
      toggleListening: "Ctrl+Shift+L",
      regenerateAnswer: "Ctrl+Shift+R",
    },
  };
}

interface DevState {
  settings: Settings;
  profiles: Profile[];
  credentials: Set<ProviderKind>;
}

let state: DevState = createState();

function createState(): DevState {
  return { settings: defaultSettings(), profiles: [], credentials: new Set() };
}

/** Clears preview state. Used by tests to stay independent of each other. */
export function resetDevBackend(): void {
  state = createState();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Throws the same wire shape a real Rust command rejects with. */
function fail(kind: IpcErrorPayload["kind"], message: string): never {
  const payload: IpcErrorPayload = { kind, message, retryable: false };
  throw payload;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function normalizeTags(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requireArg<T>(args: Record<string, unknown> | undefined, key: string): T {
  const value = args?.[key];
  if (value === undefined || value === null) {
    fail("internal", `The preview backend was called without "${key}".`);
  }
  return value as T;
}

function findProfile(id: string): Profile {
  const profile = state.profiles.find((candidate) => candidate.id === id);
  if (!profile) {
    fail("notFound", "That profile no longer exists. It may have been deleted.");
  }
  return profile;
}

/**
 * Builds a stored profile from input.
 *
 * Mirrors only the rules a user would notice immediately in the preview; the
 * real invariants (length caps, child limits) live in Rust.
 */
function buildProfile(input: ProfileInput, existing?: Profile): Profile {
  const name = input.name.trim();
  if (!name) {
    fail("validation", "Profile name cannot be empty.");
  }

  const timestamp = nowIso();

  return {
    id: existing?.id ?? newId(),
    name,
    headline: optionalText(input.headline),
    summary: optionalText(input.summary),
    skills: normalizeTags(input.skills),
    technologies: normalizeTags(input.technologies),
    achievements: normalizeTags(input.achievements),
    opinions: normalizeTags(input.opinions),
    experiences: (input.experiences ?? []).map((experience) => {
      const company = experience.company.trim();
      const role = experience.role.trim();
      if (!company) fail("validation", "Company cannot be empty.");
      if (!role) fail("validation", "Role cannot be empty.");

      return {
        id: experience.id ?? newId(),
        company,
        role,
        description: optionalText(experience.description),
        startDate: optionalText(experience.startDate),
        endDate: optionalText(experience.endDate),
      };
    }),
    projects: (input.projects ?? []).map((project) => {
      const projectName = project.name.trim();
      if (!projectName) fail("validation", "Project name cannot be empty.");

      return {
        id: project.id ?? newId(),
        name: projectName,
        description: optionalText(project.description),
        technologies: normalizeTags(project.technologies),
        url: optionalText(project.url),
      };
    }),
    stories: (input.stories ?? []).map((story) => {
      const title = story.title.trim();
      if (!title) fail("validation", "Story title cannot be empty.");

      return {
        id: story.id ?? newId(),
        title,
        situation: story.situation?.trim() ?? "",
        task: story.task?.trim() ?? "",
        action: story.action?.trim() ?? "",
        result: story.result?.trim() ?? "",
        tags: normalizeTags(story.tags),
      };
    }),
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function summarize(profile: Profile): ProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    headline: profile.headline,
    skillCount: profile.skills.length,
    experienceCount: profile.experiences.length,
    projectCount: profile.projects.length,
    storyCount: profile.stories.length,
    isActive: state.settings.activeProfileId === profile.id,
    updatedAt: profile.updatedAt,
  };
}

function applyPatch(patch: SettingsPatch): Settings {
  const merged: Settings = { ...state.settings };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    // `activeProfileId: null` is a deliberate "clear it", so null is assigned
    // rather than skipped — matching the Rust `double_option` behaviour.
    Object.assign(merged, { [key]: value });
  }

  // The one settings rule worth reproducing: an out-of-range delay would
  // otherwise appear to save and then behave differently in the real app.
  if (merged.responseDelayMs > MAX_RESPONSE_DELAY_MS) {
    fail(
      "validation",
      `The response delay must be between 0 and ${MAX_RESPONSE_DELAY_MS / 1_000} seconds.`,
    );
  }

  state.settings = merged;
  return merged;
}

function credentialStatus(provider: ProviderKind): CredentialStatus {
  return { provider, configured: state.credentials.has(provider) };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const APP_INFO: AppInfo = {
  name: "zaper",
  version: "0.1.0",
  environment: "browser",
  platform: "web",
};

const handlers: Record<DevCommand, (args?: Record<string, unknown>) => unknown> = {
  get_app_info: () => APP_INFO,

  get_settings: () => state.settings,
  update_settings: (args) => applyPatch(requireArg<SettingsPatch>(args, "patch")),
  reset_settings: () => {
    state.settings = defaultSettings();
    return state.settings;
  },

  list_profiles: () =>
    [...state.profiles]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((profile) => summarize(profile)),

  get_profile: (args) => findProfile(requireArg<string>(args, "id")),

  get_active_profile: () => {
    const id = state.settings.activeProfileId;
    return id ? (state.profiles.find((profile) => profile.id === id) ?? null) : null;
  },

  create_profile: (args) => {
    const profile = buildProfile(requireArg<ProfileInput>(args, "input"));
    state.profiles.push(profile);
    return profile;
  },

  update_profile: (args) => {
    const id = requireArg<string>(args, "id");
    const existing = findProfile(id);
    const updated = buildProfile(requireArg<ProfileInput>(args, "input"), existing);
    state.profiles = state.profiles.map((profile) => (profile.id === id ? updated : profile));
    return updated;
  },

  duplicate_profile: (args) => {
    const original = findProfile(requireArg<string>(args, "id"));
    const copy: Profile = {
      ...structuredClone(original),
      id: newId(),
      name: `${original.name} (copy)`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    // Fresh child ids, so editing the copy cannot affect the original.
    copy.experiences = copy.experiences.map((child) => ({ ...child, id: newId() }));
    copy.projects = copy.projects.map((child) => ({ ...child, id: newId() }));
    copy.stories = copy.stories.map((child) => ({ ...child, id: newId() }));

    state.profiles.push(copy);
    return copy;
  },

  delete_profile: (args) => {
    const id = requireArg<string>(args, "id");
    findProfile(id);
    state.profiles = state.profiles.filter((profile) => profile.id !== id);

    if (state.settings.activeProfileId === id) {
      state.settings = { ...state.settings, activeProfileId: null };
    }

    return null;
  },

  set_active_profile: (args) => {
    const profile = findProfile(requireArg<string>(args, "id"));
    state.settings = { ...state.settings, activeProfileId: profile.id };
    return profile;
  },

  set_provider_credential: (args) => {
    const provider = requireArg<ProviderKind>(args, "provider");
    const secret = requireArg<string>(args, "secret");

    if (provider === "mock") {
      fail("validation", "The mock provider does not use an API key.");
    }
    if (!secret.trim()) {
      fail("validation", "The API key cannot be empty.");
    }

    state.credentials.add(provider);
    return credentialStatus(provider);
  },

  get_credential_status: (args) => credentialStatus(requireArg<ProviderKind>(args, "provider")),

  list_credential_status: () => {
    const providers = new Set<ProviderKind>();
    for (const config of Object.values(state.settings.providers)) {
      if (config.provider !== "mock") providers.add(config.provider);
    }
    return [...providers].map((provider) => credentialStatus(provider));
  },

  delete_provider_credential: (args) => {
    const provider = requireArg<ProviderKind>(args, "provider");
    state.credentials.delete(provider);
    return credentialStatus(provider);
  },
};

/** Executes a preview command. Async to match the real transport's shape. */
export async function callDevCommand(
  command: DevCommand,
  args?: Record<string, unknown>,
): Promise<unknown> {
  return handlers[command](args);
}
