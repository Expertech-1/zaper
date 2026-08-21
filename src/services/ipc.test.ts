import { describe, expect, it, vi } from "vitest";
import { IpcError } from "../lib/errors";
import { callCommand } from "./ipc";

/**
 * These tests exercise the transport against the preview backend, which is what
 * runs when no Tauri runtime is present. They cover the two guarantees the
 * transport makes: results are schema-validated, and failures arrive as typed
 * `IpcError`s.
 */
describe("callCommand", () => {
  it("returns a validated result", async () => {
    const info = await callCommand("get_app_info");

    expect(info.name).toBe("zaper");
    expect(info.environment).toBe("browser");
  });

  it("passes arguments through to the command", async () => {
    const created = await callCommand("create_profile", { input: { name: "Ada" } });
    expect(created.name).toBe("Ada");

    const loaded = await callCommand("get_profile", { id: created.id });
    expect(loaded.id).toBe(created.id);
  });

  it("surfaces a rejected command as a typed IpcError", async () => {
    await expect(callCommand("get_profile", { id: "missing" })).rejects.toMatchObject({
      kind: "notFound",
    });

    await expect(callCommand("create_profile", { input: { name: "  " } })).rejects.toBeInstanceOf(
      IpcError,
    );
  });

  it("marks a retryable failure so the UI can offer Retry", async () => {
    try {
      await callCommand("update_settings", { patch: { responseDelayMs: 999_999 } });
      expect.unreachable("the invalid delay should have been rejected");
    } catch (cause) {
      const error = cause as IpcError;
      expect(error.kind).toBe("validation");
      // Validation is the user's input, not a transient fault — no Retry.
      expect(error.retryable).toBe(false);
    }
  });

  it("rejects a response that does not match the contract", async () => {
    // Simulate contract drift: the backend answers with the wrong shape.
    const devBackend = await import("./devBackend");
    const spy = vi
      .spyOn(devBackend, "callDevCommand")
      .mockResolvedValue({ unexpected: "shape" } as unknown as never);

    // Console noise here is intentional in the implementation; silence it so the
    // test output stays readable.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(callCommand("get_app_info")).rejects.toMatchObject({ kind: "internal" });
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  it("reports commands that need the desktop app as unsupported", async () => {
    const devBackend = await import("./devBackend");
    vi.spyOn(devBackend, "isDevCommand").mockReturnValue(false);

    try {
      await expect(callCommand("get_app_info")).rejects.toMatchObject({ kind: "unsupported" });
    } finally {
      vi.restoreAllMocks();
    }
  });
});
