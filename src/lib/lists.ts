/**
 * Conversions between the domain's `string[]` fields and the flat text the
 * editors present.
 *
 * Two conventions, chosen to match how the data reads:
 *
 * * **Comma-separated** for short tags (skills, technologies, story tags).
 * * **One per line** for full sentences (achievements, opinions), which
 *   frequently contain commas of their own.
 *
 * These functions only shape text. Trimming, de-duplication and length limits
 * are enforced by Rust on save, so the two never disagree.
 */

/** Splits a comma-separated editor value into a list. */
export function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Joins a stored list into the comma-separated editor representation. */
export function joinTags(values: readonly string[]): string {
  return values.join(", ");
}

/** Splits a multi-line editor value into a list, one entry per line. */
export function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Joins a stored list into the one-per-line editor representation. */
export function joinLines(values: readonly string[]): string {
  return values.join("\n");
}

/** Normalizes a form field to `string | null` for the IPC payload. */
export function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
