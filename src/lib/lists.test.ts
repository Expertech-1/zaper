import { describe, expect, it } from "vitest";
import { joinLines, joinTags, splitLines, splitTags, textOrNull } from "./lists";

describe("splitTags", () => {
  it("trims entries and drops empties", () => {
    expect(splitTags(" Rust , TypeScript ,, ")).toEqual(["Rust", "TypeScript"]);
  });

  it("returns an empty list for blank input", () => {
    expect(splitTags("   ")).toEqual([]);
    expect(splitTags("")).toEqual([]);
  });

  it("round-trips through joinTags", () => {
    const values = ["Rust", "PipeWire"];
    expect(splitTags(joinTags(values))).toEqual(values);
  });
});

describe("splitLines", () => {
  it("splits on newlines and keeps commas inside an entry", () => {
    expect(splitLines("Shipped Zaper, on time\n\n Cut latency in half ")).toEqual([
      "Shipped Zaper, on time",
      "Cut latency in half",
    ]);
  });

  it("round-trips through joinLines", () => {
    const values = ["First achievement", "Second, with a comma"];
    expect(splitLines(joinLines(values))).toEqual(values);
  });
});

describe("textOrNull", () => {
  it("maps blank input to null and trims the rest", () => {
    expect(textOrNull("   ")).toBeNull();
    expect(textOrNull("")).toBeNull();
    expect(textOrNull("  hello  ")).toBe("hello");
  });
});
