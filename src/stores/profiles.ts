/**
 * Profiles store.
 *
 * Holds the lightweight summary list for navigation. Full profiles are fetched
 * on demand by the editor, so opening the app never loads every child row.
 *
 * Mutations round-trip through Rust and then refresh the list, so counts and
 * the active flag always reflect persisted state.
 */

import { create } from "zustand";
import { IpcError, toIpcError } from "../lib/errors";
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  listProfiles,
  setActiveProfile,
  updateProfile,
} from "../services/profiles";
import type { Profile, ProfileInput, ProfileSummary } from "../types/ipc";
import { useSettingsStore } from "./settings";
import type { LoadStatus } from "./status";

interface ProfilesState {
  summaries: ProfileSummary[];
  status: LoadStatus;
  error: IpcError | null;
  /** True while a create/update/delete is in flight. */
  mutating: boolean;

  load: () => Promise<void>;
  create: (input: ProfileInput) => Promise<Profile>;
  update: (id: string, input: ProfileInput) => Promise<Profile>;
  duplicate: (id: string) => Promise<Profile>;
  remove: (id: string) => Promise<void>;
  activate: (id: string) => Promise<Profile>;
  clearError: () => void;
}

export const useProfilesStore = create<ProfilesState>()((set, get) => {
  /** Reloads the list after a mutation, without flipping back to "loading". */
  const refresh = async () => {
    const summaries = await listProfiles();
    set({ summaries, status: "ready" });
  };

  /**
   * Runs a mutation with consistent status handling: surface the typed error,
   * keep the current list visible, and always clear the mutating flag.
   */
  const mutate = async <T>(action: () => Promise<T>): Promise<T> => {
    set({ mutating: true, error: null });
    try {
      const result = await action();
      await refresh();
      return result;
    } catch (cause) {
      set({ error: toIpcError(cause) });
      throw cause;
    } finally {
      set({ mutating: false });
    }
  };

  return {
    summaries: [],
    status: "idle",
    error: null,
    mutating: false,

    load: async () => {
      if (get().status === "loading") return;

      set({ status: "loading", error: null });
      try {
        await refresh();
      } catch (cause) {
        set({ status: "error", error: toIpcError(cause) });
      }
    },

    create: (input) => mutate(() => createProfile(input)),
    update: (id, input) => mutate(() => updateProfile(id, input)),
    duplicate: (id) => mutate(() => duplicateProfile(id)),

    remove: async (id) => {
      await mutate(async () => {
        await deleteProfile(id);
        // Deleting the active profile clears it in settings; mirror that here so
        // the rest of the UI does not keep pointing at a deleted row.
        await useSettingsStore.getState().load();
      });
    },

    activate: (id) =>
      mutate(async () => {
        const profile = await setActiveProfile(id);
        await useSettingsStore.getState().load();
        return profile;
      }),

    clearError: () => set({ error: null }),
  };
});
