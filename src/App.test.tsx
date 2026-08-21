import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the shell with the dashboard heading", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /welcome to zaper/i })).toBeInTheDocument();
  });

  it("renders the main navigation sections", () => {
    render(<App />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    for (const label of ["Dashboard", "Interview", "Profiles", "Meetings", "Settings"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
