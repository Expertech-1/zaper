import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProfilesView } from "./ProfilesView";

/**
 * These run against the in-memory preview backend, so they exercise the real
 * store → service → transport path without a Rust process.
 */
async function createProfile(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("button", { name: /new profile/i }));
  await user.type(screen.getByLabelText("Name"), name);
  await user.click(screen.getByRole("button", { name: /create profile/i }));
}

describe("ProfilesView", () => {
  it("shows an empty state before any profile exists", async () => {
    render(<ProfilesView />);

    expect(await screen.findByText(/no profiles yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create your first profile/i })).toBeInTheDocument();
  });

  it("creates a profile and lists it", async () => {
    const user = userEvent.setup();
    render(<ProfilesView />);

    await createProfile(user, "Ada Lovelace");

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/0 skills · 0 roles/)).toBeInTheDocument();
  });

  it("reports a validation error instead of saving an unnamed profile", async () => {
    const user = userEvent.setup();
    render(<ProfilesView />);

    await user.click(await screen.findByRole("button", { name: /new profile/i }));
    await user.click(screen.getByRole("button", { name: /create profile/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/cannot be empty/i);

    // Still on the form, so nothing was lost.
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("saves skills and child rows entered in the editor", async () => {
    const user = userEvent.setup();
    render(<ProfilesView />);

    await user.click(await screen.findByRole("button", { name: /new profile/i }));
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.type(screen.getByLabelText("Skills"), "Rust, rust, SQL");

    await user.click(screen.getByRole("button", { name: /add role/i }));
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText("Role"), "Staff Engineer");

    await user.click(screen.getByRole("button", { name: /create profile/i }));

    // "rust" is a duplicate of "Rust" and is dropped during normalization.
    expect(await screen.findByText(/2 skills · 1 role/)).toBeInTheDocument();
  });

  it("activates a profile and marks it in the list", async () => {
    const user = userEvent.setup();
    render(<ProfilesView />);

    await createProfile(user, "Ada");

    await user.click(await screen.findByRole("button", { name: /set active/i }));

    expect(await screen.findByText("active")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /set active/i })).not.toBeInTheDocument(),
    );
  });

  it("duplicates a profile under a distinct name", async () => {
    const user = userEvent.setup();
    render(<ProfilesView />);

    await createProfile(user, "Ada");
    await user.click(await screen.findByRole("button", { name: /duplicate/i }));

    expect(await screen.findByText("Ada (copy)")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("requires confirmation before deleting", async () => {
    const user = userEvent.setup();
    render(<ProfilesView />);

    await createProfile(user, "Ada");

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete?")).toBeInTheDocument();

    // Backing out keeps the profile.
    await user.click(screen.getByRole("button", { name: /keep/i }));
    expect(screen.getByText("Ada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /yes, delete/i }));

    await waitFor(() => expect(screen.queryByText("Ada")).not.toBeInTheDocument());
    expect(await screen.findByText(/no profiles yet/i)).toBeInTheDocument();
  });

  it("loads an existing profile back into the editor", async () => {
    const user = userEvent.setup();
    render(<ProfilesView />);

    await createProfile(user, "Ada");
    await user.click(await screen.findByRole("button", { name: /^edit$/i }));

    const nameField = await screen.findByLabelText("Name");
    expect(nameField).toHaveValue("Ada");

    await user.clear(nameField);
    await user.type(nameField, "Ada L.");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Ada L.")).toBeInTheDocument();
  });
});
