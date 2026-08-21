import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the shell with the dashboard heading", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /welcome to zaper/i })).toBeInTheDocument();
  });

  it("renders the main navigation sections", async () => {
    render(<App />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    for (const label of ["Dashboard", "Interview", "Profiles", "Meetings", "Settings"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    // Let the mount-time loads settle so the assertions above are not racing
    // against state updates.
    await waitFor(() => expect(screen.getByText(/active profile/i)).toBeInTheDocument());
  });

  it("navigates between sections", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Profiles" }));
    expect(await screen.findByRole("heading", { name: "Profiles" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("guides the user to create a profile when none exists", async () => {
    const user = userEvent.setup();
    render(<App />);

    const cta = await screen.findByRole("button", { name: /go to profiles/i });
    await user.click(cta);

    expect(await screen.findByRole("heading", { name: "Profiles" })).toBeInTheDocument();
  });
});
