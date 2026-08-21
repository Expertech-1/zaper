/**
 * Settings and credential commands.
 *
 * Credentials are write-only by design: there is no function here that reads a
 * secret back, because the Rust core exposes no command to do so.
 */

import { callCommand } from "./ipc";
import type { CredentialStatus, ProviderKind, Settings, SettingsPatch } from "../types/ipc";

/** Current settings, or defaults on a fresh install. */
export async function getSettings(): Promise<Settings> {
  return callCommand("get_settings");
}

/**
 * Applies a partial update and returns the full persisted document.
 *
 * Pass `activeProfileId: null` to clear the selection; omit a key to leave it
 * untouched.
 */
export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return callCommand("update_settings", { patch });
}

/** Restores factory defaults. Stored credentials are not affected. */
export async function resetSettings(): Promise<Settings> {
  return callCommand("reset_settings");
}

/** Saves an API key into the OS keyring. */
export async function setProviderCredential(
  provider: ProviderKind,
  secret: string,
): Promise<CredentialStatus> {
  return callCommand("set_provider_credential", { provider, secret });
}

/** Whether a credential is stored for one provider. */
export async function getCredentialStatus(provider: ProviderKind): Promise<CredentialStatus> {
  return callCommand("get_credential_status", { provider });
}

/** Credential status for every provider the current settings actually use. */
export async function listCredentialStatus(): Promise<CredentialStatus[]> {
  return callCommand("list_credential_status");
}

/** Removes a stored credential. Idempotent. */
export async function deleteProviderCredential(provider: ProviderKind): Promise<CredentialStatus> {
  return callCommand("delete_provider_credential", { provider });
}
