/**
 * Profile commands.
 *
 * Thin, typed wrappers — no business logic. Validation and persistence belong
 * to Rust; these functions exist so components never touch command strings.
 */

import { callCommand } from "./ipc";
import type { Profile, ProfileInput, ProfileSummary } from "../types/ipc";

/** Profiles with child counts and the active flag, newest activity first. */
export async function listProfiles(): Promise<ProfileSummary[]> {
  return callCommand("list_profiles");
}

/** Loads one complete profile. */
export async function getProfile(id: string): Promise<Profile> {
  return callCommand("get_profile", { id });
}

/** The active profile, or `null` when none is selected. */
export async function getActiveProfile(): Promise<Profile | null> {
  return callCommand("get_active_profile");
}

export async function createProfile(input: ProfileInput): Promise<Profile> {
  return callCommand("create_profile", { input });
}

export async function updateProfile(id: string, input: ProfileInput): Promise<Profile> {
  return callCommand("update_profile", { id, input });
}

export async function duplicateProfile(id: string): Promise<Profile> {
  return callCommand("duplicate_profile", { id });
}

export async function deleteProfile(id: string): Promise<void> {
  await callCommand("delete_profile", { id });
}

/** Marks a profile active and returns it. */
export async function setActiveProfile(id: string): Promise<Profile> {
  return callCommand("set_active_profile", { id });
}
