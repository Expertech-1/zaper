import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getSettings } from "../../services/settings";
import { SettingsView } from "./SettingsView";

describe("SettingsView", () => {
  it("renders the persisted settings", async () => {
    render(<SettingsView />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("Answer length")).toHaveValue("medium");
    expect(screen.getByLabelText("Default mode")).toHaveValue("research");
  });

  it("persists a changed answer length", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.selectOptions(await screen.findByLabelText("Answer length"), "detailed");

    await waitFor(async () => {
      expect((await getSettings()).answerLength).toBe("detailed");
    });
  });

  it("shows the response delay in seconds and stores milliseconds", async () => {
    render(<SettingsView />);

    // 1500 ms default.
    expect(await screen.findByText(/wait before answering — 1\.5s/i)).toBeInTheDocument();
  });

  it("commits a text field on blur rather than on every keystroke", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    const language = await screen.findByLabelText("Language");
    await user.clear(language);
    await user.type(language, "en-GB");

    // Mid-edit, nothing has been written yet — an intermediate value like "e"
    // must never reach the database.
    expect((await getSettings()).language).toBe("auto");

    await user.tab();

    await waitFor(async () => {
      expect((await getSettings()).language).toBe("en-GB");
    });
  });

  it("explains that nothing is sent to the cloud while providers are mocked", async () => {
    render(<SettingsView />);

    expect(await screen.findByText(/what is sent to cloud ai/i)).toBeInTheDocument();
    expect(screen.getByText(/no data leaves this machine/i)).toBeInTheDocument();
  });

  it("asks for an API key only after a cloud provider is selected", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    // The mock provider needs no credential, so the key section is absent.
    await screen.findByRole("heading", { name: "AI providers" });
    expect(screen.queryByRole("heading", { name: "API keys" })).not.toBeInTheDocument();

    const providerSelects = screen.getAllByLabelText("Provider");
    await user.selectOptions(providerSelects[0]!, "openAi");

    expect(await screen.findByRole("heading", { name: "API keys" })).toBeInTheDocument();
    expect(screen.getByText(/not set/i)).toBeInTheDocument();
  });

  it("never renders a stored key back to the user", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    const providerSelects = await screen.findAllByLabelText("Provider");
    await user.selectOptions(providerSelects[0]!, "openAi");

    const keyField = await screen.findByLabelText(/openai/i);
    await user.type(keyField, "sk-secret-value");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // The field clears on save and the stored value is never echoed back.
    await waitFor(() => expect(keyField).toHaveValue(""));
    expect(screen.queryByDisplayValue("sk-secret-value")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /replace/i })).toBeInTheDocument();
  });

  it("restores defaults", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.selectOptions(await screen.findByLabelText("Default mode"), "coding");
    await waitFor(async () => expect((await getSettings()).defaultMode).toBe("coding"));

    await user.click(screen.getByRole("button", { name: /restore defaults/i }));

    await waitFor(async () => expect((await getSettings()).defaultMode).toBe("research"));
  });
});
