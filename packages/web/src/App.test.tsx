import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "./App.tsx";
import { renderWithProviders } from "./test/render.tsx";

describe("App", () => {
  it("increments the count when the counter button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    const button = await screen.findByRole("button", { name: /^Count = \d+/ });
    const initial = parseInt(button.textContent!.replace("Count = ", ""));

    await user.click(button);

    expect(
      await screen.findByRole("button", {
        name: `Count = ${initial + 1}`,
      }),
    ).toBeInTheDocument();
  });
});
