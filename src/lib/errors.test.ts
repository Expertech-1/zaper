import { describe, expect, it } from "vitest";
import { IpcError, isValidationError, toIpcError } from "./errors";

describe("toIpcError", () => {
  it("adopts a structured error from the Rust core", () => {
    const error = toIpcError({
      kind: "network",
      message: "The AI service could not be reached.",
      retryable: true,
    });

    expect(error).toBeInstanceOf(IpcError);
    expect(error.kind).toBe("network");
    expect(error.message).toBe("The AI service could not be reached.");
    expect(error.retryable).toBe(true);
  });

  it("wraps a transport-level string into an internal error", () => {
    const error = toIpcError("command not found");

    expect(error.kind).toBe("internal");
    expect(error.message).toBe("command not found");
    expect(error.retryable).toBe(false);
  });

  it("wraps a plain Error", () => {
    const error = toIpcError(new Error("webview went away"));

    expect(error.kind).toBe("internal");
    expect(error.message).toBe("webview went away");
  });

  it("passes an existing IpcError through unchanged", () => {
    const original = new IpcError({ kind: "cancelled", message: "Stopped.", retryable: false });
    expect(toIpcError(original)).toBe(original);
  });

  it("always produces a non-empty message", () => {
    expect(toIpcError("").message.length).toBeGreaterThan(0);
    expect(toIpcError(undefined).message.length).toBeGreaterThan(0);
  });
});

describe("isValidationError", () => {
  it("only matches validation failures", () => {
    expect(
      isValidationError(new IpcError({ kind: "validation", message: "Bad", retryable: false })),
    ).toBe(true);

    expect(
      isValidationError(new IpcError({ kind: "database", message: "Bad", retryable: true })),
    ).toBe(false);

    expect(isValidationError(new Error("Bad"))).toBe(false);
  });
});
