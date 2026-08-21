import { describe, expect, it } from "vitest";
import type { Profile } from "../../types/ipc";
import {
  emptyProfileForm,
  profileToForm,
  toProfileInput,
  type ProfileFormState,
} from "./profileForm";

const storedProfile: Profile = {
  id: "p1",
  name: "Ada Lovelace",
  headline: "Senior Engineer",
  summary: "Builds Linux desktop software.",
  skills: ["Rust", "TypeScript"],
  technologies: ["Tauri"],
  achievements: ["Shipped Zaper, on time"],
  opinions: ["Prefer boring technology."],
  experiences: [
    {
      id: "e1",
      company: "Acme",
      role: "Staff Engineer",
      description: "Led the audio pipeline.",
      startDate: "2022",
      endDate: null,
    },
  ],
  projects: [
    { id: "r1", name: "Zaper", description: null, technologies: ["Rust"], url: "https://x.dev" },
  ],
  stories: [
    {
      id: "s1",
      title: "Cut latency in half",
      situation: "Answers took four seconds.",
      task: "Reduce time to first token.",
      action: "Streamed tokens.",
      result: "Under two seconds.",
      tags: ["performance"],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("profileToForm", () => {
  it("flattens a stored profile into editor text", () => {
    const form = profileToForm(storedProfile);

    expect(form.name).toBe("Ada Lovelace");
    expect(form.skills).toBe("Rust, TypeScript");
    expect(form.achievements).toBe("Shipped Zaper, on time");
    expect(form.experiences[0]?.id).toBe("e1");
    expect(form.experiences[0]?.endDate).toBe("");
  });

  it("maps nulls to empty strings so inputs stay controlled", () => {
    const form = profileToForm({ ...storedProfile, headline: null, summary: null });

    expect(form.headline).toBe("");
    expect(form.summary).toBe("");
    expect(form.projects[0]?.description).toBe("");
  });
});

describe("toProfileInput", () => {
  it("round-trips a stored profile without losing data", () => {
    const input = toProfileInput(profileToForm(storedProfile));

    expect(input.name).toBe(storedProfile.name);
    expect(input.skills).toEqual(storedProfile.skills);
    expect(input.achievements).toEqual(storedProfile.achievements);
    expect(input.experiences).toHaveLength(1);
    expect(input.experiences?.[0]?.id).toBe("e1");
    expect(input.experiences?.[0]?.endDate).toBeNull();
    expect(input.stories?.[0]?.tags).toEqual(["performance"]);
  });

  it("keeps ids for existing children and omits them for new rows", () => {
    const form = profileToForm(storedProfile);
    form.experiences.push({
      key: "draft-1",
      company: "Globex",
      role: "Engineer",
      description: "",
      startDate: "",
      endDate: "",
    });

    const input = toProfileInput(form);

    expect(input.experiences?.[0]?.id).toBe("e1");
    expect(input.experiences?.[1]?.id).toBeUndefined();
  });

  it("drops child rows the user added but never filled in", () => {
    const form: ProfileFormState = {
      ...emptyProfileForm(),
      name: "Ada",
      experiences: [
        { key: "a", company: "  ", role: "", description: "", startDate: "", endDate: "" },
      ],
      projects: [{ key: "b", name: "", description: "", technologies: "", url: "" }],
      stories: [{ key: "c", title: "", situation: "", task: "", action: "", result: "", tags: "" }],
    };

    const input = toProfileInput(form);

    expect(input.experiences).toEqual([]);
    expect(input.projects).toEqual([]);
    expect(input.stories).toEqual([]);
  });

  it("keeps a partially filled child so its validation error is surfaced", () => {
    const form: ProfileFormState = {
      ...emptyProfileForm(),
      name: "Ada",
      experiences: [
        { key: "a", company: "Acme", role: "", description: "", startDate: "", endDate: "" },
      ],
    };

    // The row is meaningful (a company was typed) so it is sent, and Rust
    // rejects the missing role rather than the row vanishing silently.
    expect(toProfileInput(form).experiences).toHaveLength(1);
  });

  it("normalizes blanks to null and splits list fields", () => {
    const form: ProfileFormState = {
      ...emptyProfileForm(),
      name: "  Ada  ",
      headline: "   ",
      skills: " Rust , , SQL ",
      opinions: "First\n\nSecond",
    };

    const input = toProfileInput(form);

    expect(input.name).toBe("Ada");
    expect(input.headline).toBeNull();
    expect(input.skills).toEqual(["Rust", "SQL"]);
    expect(input.opinions).toEqual(["First", "Second"]);
  });
});
