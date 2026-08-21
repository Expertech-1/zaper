import { z } from "zod";

/**
 * =============================================================================
 * IPC CONTRACT — single source of truth between React and the Rust/Tauri core.
 * =============================================================================
 *
 * Rule: every command name, payload shape and event name used anywhere in the
 * frontend MUST be declared here (or in a sibling `events.ts`) and kept in sync
 * with the Rust command definitions under `src-tauri/src/commands/`.
 *
 * No scattered `invoke("some_string")` calls with ad-hoc shapes.
 *
 * Everything crossing the boundary is validated with Zod on arrival. Rust is
 * trusted code, but the schemas catch contract drift the moment it happens
 * instead of letting `undefined` propagate into a component.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Mirrors `ErrorKind` in `src-tauri/src/error.rs`. The UI switches on this to
 * distinguish a network blip from a validation mistake from a cancellation.
 */
export const errorKindSchema = z.enum([
  "validation",
  "notFound",
  "database",
  "credential",
  "io",
  "network",
  "provider",
  "unsupported",
  "cancelled",
  "internal",
]);

export type ErrorKind = z.infer<typeof errorKindSchema>;

/** Mirrors `IpcError` in `src-tauri/src/error.rs`. */
export const ipcErrorSchema = z.object({
  kind: errorKindSchema,
  message: z.string(),
  retryable: z.boolean(),
});

export type IpcErrorPayload = z.infer<typeof ipcErrorSchema>;

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

export const modeSchema = z.enum(["research", "job", "coding"]);
export type Mode = z.infer<typeof modeSchema>;

export const answerLengthSchema = z.enum(["short", "medium", "detailed"]);
export type AnswerLength = z.infer<typeof answerLengthSchema>;

export const themeSchema = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof themeSchema>;

export const providerKindSchema = z.enum([
  "mock",
  "openAi",
  "anthropic",
  "google",
  "openAiCompatible",
]);
export type ProviderKind = z.infer<typeof providerKindSchema>;

/** Providers that need an API key. Mirrors `ProviderKind::requires_credential`. */
export function providerRequiresCredential(provider: ProviderKind): boolean {
  return provider !== "mock";
}

/** Providers where the user must supply the base URL themselves. */
export function providerRequiresEndpoint(provider: ProviderKind): boolean {
  return provider === "openAiCompatible";
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

/** Result of the `get_app_info` Rust command (M0 "hello" IPC). */
export const appInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  environment: z.enum(["development", "production", "browser"]),
  platform: z.string(),
});

export type AppInfo = z.infer<typeof appInfoSchema>;

// ---------------------------------------------------------------------------
// Profiles — mirrors `src-tauri/src/domain/profile.rs`
// ---------------------------------------------------------------------------

export const experienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
});

export type Experience = z.infer<typeof experienceSchema>;

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  technologies: z.array(z.string()),
  url: z.string().nullable(),
});

export type Project = z.infer<typeof projectSchema>;

export const starStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  tags: z.array(z.string()),
});

export type StarStory = z.infer<typeof starStorySchema>;

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  technologies: z.array(z.string()),
  achievements: z.array(z.string()),
  opinions: z.array(z.string()),
  experiences: z.array(experienceSchema),
  projects: z.array(projectSchema),
  stories: z.array(starStorySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;

export const profileSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string().nullable(),
  skillCount: z.number().int().nonnegative(),
  experienceCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  storyCount: z.number().int().nonnegative(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});

export type ProfileSummary = z.infer<typeof profileSummarySchema>;

/**
 * What the UI sends when creating or updating a profile. Child `id`s are
 * optional: omit them for new rows and the Rust side generates one.
 *
 * These mirror the `*Input` types in Rust, which re-validate everything. The
 * schemas here exist to catch mistakes before a round trip, not to replace
 * server-side validation.
 */
export const experienceInputSchema = z.object({
  id: z.string().optional(),
  company: z.string(),
  role: z.string(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export const projectInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  technologies: z.array(z.string()).optional(),
  url: z.string().nullable().optional(),
});

export const starStoryInputSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  situation: z.string().optional(),
  task: z.string().optional(),
  action: z.string().optional(),
  result: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const profileInputSchema = z.object({
  name: z.string(),
  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  skills: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  achievements: z.array(z.string()).optional(),
  opinions: z.array(z.string()).optional(),
  experiences: z.array(experienceInputSchema).optional(),
  projects: z.array(projectInputSchema).optional(),
  stories: z.array(starStoryInputSchema).optional(),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ExperienceInput = z.infer<typeof experienceInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type StarStoryInput = z.infer<typeof starStoryInputSchema>;

// ---------------------------------------------------------------------------
// Settings — mirrors `src-tauri/src/domain/settings.rs`
// ---------------------------------------------------------------------------

export const providerConfigSchema = z.object({
  provider: providerKindSchema,
  model: z.string(),
  endpoint: z.string().nullable(),
  timeoutSecs: z.number().int(),
  temperature: z.number().nullable(),
  maxOutputTokens: z.number().int().nullable(),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const providerSettingsSchema = z.object({
  llm: providerConfigSchema,
  stt: providerConfigSchema,
  tts: providerConfigSchema,
  vision: providerConfigSchema,
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

/** The four AI capabilities, each independently configurable. */
export const PROVIDER_CAPABILITIES = ["llm", "stt", "tts", "vision"] as const;
export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export const ttsSettingsSchema = z.object({
  enabled: z.boolean(),
  voice: z.string().nullable(),
  speed: z.number(),
  volume: z.number(),
});

export type TtsSettings = z.infer<typeof ttsSettingsSchema>;

export const audioSettingsSchema = z.object({
  microphoneDevice: z.string().nullable(),
  systemAudioSource: z.string().nullable(),
  captureMicrophone: z.boolean(),
  captureSystemAudio: z.boolean(),
});

export type AudioSettings = z.infer<typeof audioSettingsSchema>;

export const shortcutsSchema = z.object({
  toggleAssistant: z.string(),
  readScreen: z.string(),
  toggleMeeting: z.string(),
  toggleListening: z.string(),
  regenerateAnswer: z.string(),
});

export type Shortcuts = z.infer<typeof shortcutsSchema>;

export const settingsSchema = z.object({
  schemaVersion: z.number().int(),
  activeProfileId: z.string().nullable(),
  defaultMode: modeSchema,
  answerLength: answerLengthSchema,
  responseDelayMs: z.number().int().nonnegative(),
  language: z.string(),
  theme: themeSchema,
  diagnosticLogging: z.boolean(),
  onboardingCompleted: z.boolean(),
  providers: providerSettingsSchema,
  tts: ttsSettingsSchema,
  audio: audioSettingsSchema,
  shortcuts: shortcutsSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

/**
 * Partial update. Omitted keys are left untouched by Rust; `activeProfileId:
 * null` explicitly clears the selection (the Rust side distinguishes "absent"
 * from "null" — see `double_option` in `domain/settings.rs`).
 */
export type SettingsPatch = Partial<{
  activeProfileId: string | null;
  defaultMode: Mode;
  answerLength: AnswerLength;
  responseDelayMs: number;
  language: string;
  theme: Theme;
  diagnosticLogging: boolean;
  onboardingCompleted: boolean;
  providers: ProviderSettings;
  tts: TtsSettings;
  audio: AudioSettings;
  shortcuts: Shortcuts;
}>;

/** Upper bound on the "wait before answering" delay (`MAX_RESPONSE_DELAY_MS`). */
export const MAX_RESPONSE_DELAY_MS = 9_000;

// ---------------------------------------------------------------------------
// Credentials — mirrors `src-tauri/src/commands/credentials.rs`
// ---------------------------------------------------------------------------

/**
 * Note what this type does NOT contain: the secret. Credentials are write-only
 * from the frontend's perspective — there is no command that returns a key.
 */
export const credentialStatusSchema = z.object({
  provider: providerKindSchema,
  configured: z.boolean(),
});

export type CredentialStatus = z.infer<typeof credentialStatusSchema>;

// ---------------------------------------------------------------------------
// Command registry
// ---------------------------------------------------------------------------

/**
 * Every command exposed by the Rust core, keyed by the exact name registered in
 * `src-tauri/src/lib.rs`. The value is the Zod schema for the RESULT payload,
 * validated at the boundary by `services/ipc.ts`.
 */
export const commandRegistry = {
  get_app_info: appInfoSchema,

  get_settings: settingsSchema,
  update_settings: settingsSchema,
  reset_settings: settingsSchema,

  list_profiles: z.array(profileSummarySchema),
  get_profile: profileSchema,
  get_active_profile: profileSchema.nullable(),
  create_profile: profileSchema,
  update_profile: profileSchema,
  duplicate_profile: profileSchema,
  delete_profile: z.null(),
  set_active_profile: profileSchema,

  set_provider_credential: credentialStatusSchema,
  get_credential_status: credentialStatusSchema,
  list_credential_status: z.array(credentialStatusSchema),
  delete_provider_credential: credentialStatusSchema,
} as const;

export type CommandName = keyof typeof commandRegistry;
