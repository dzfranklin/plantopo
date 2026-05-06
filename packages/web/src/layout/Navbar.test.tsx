import { describe, expect, it } from "vitest";

import { TEST_USER, renderWithProviders } from "../test/render.tsx";
import { Navbar } from "./Navbar.tsx";

describe("Navbar", () => {
  it("shows the logged-in user's name", async () => {
    const screen = await renderWithProviders(<Navbar />);

    await expect.element(screen.getByText(TEST_USER.name)).toBeInTheDocument();
  });

  it("shows a login link when logged out", async () => {
    const screen = await renderWithProviders(<Navbar />, { user: null });

    await expect
      .element(screen.getByRole("link", { name: "Sign in" }))
      .toBeInTheDocument();
  });
});
