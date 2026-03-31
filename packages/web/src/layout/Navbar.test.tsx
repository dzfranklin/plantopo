import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TEST_USER } from "@pt/api/test/setupDb";

import { renderWithProviders } from "../test/render.tsx";
import { Navbar } from "./Navbar.tsx";

describe("Navbar", () => {
  it("shows the logged-in user's name", async () => {
    renderWithProviders(<Navbar />);

    expect(await screen.findByText(TEST_USER.name)).toBeInTheDocument();
  });

  it("shows a login link when logged out", async () => {
    renderWithProviders(<Navbar />, { session: null });

    expect(
      await screen.findByRole("link", { name: "Sign in" }),
    ).toBeInTheDocument();
  });
});
