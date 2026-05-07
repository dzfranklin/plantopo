import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import StravaImportPage from "./StravaImportPage";
import { server } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { trpc } from "@/test/trpc";

describe("StravaImportPage", () => {
  it("shows the first page of activities", async () => {
    const screen = await renderWithProviders(<StravaImportPage />);

    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();
    await expect.element(screen.getByText("Evening Jog")).toBeInTheDocument();
  });

  it("Previous button is disabled on the first page", async () => {
    const screen = await renderWithProviders(<StravaImportPage />);

    await expect
      .element(screen.getByRole("button", { name: /previous/i }))
      .toBeDisabled();
  });

  it("navigates to the next page", async () => {
    const screen = await renderWithProviders(<StravaImportPage />);

    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await expect.element(screen.getByText("Long Run")).toBeInTheDocument();
    await expect.element(screen.getByText("Recovery Run")).toBeInTheDocument();
  });

  it("Next button is disabled on the last page", async () => {
    const screen = await renderWithProviders(<StravaImportPage />, {
      initialPath: `/strava/import?cursor=1700000000`,
    });

    await expect.element(screen.getByText("Long Run")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /next/i }))
      .toBeDisabled();
  });

  it("navigates back to the first page", async () => {
    const screen = await renderWithProviders(<StravaImportPage />);

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await expect.element(screen.getByText("Long Run")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /previous/i }));
    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();
  });

  it("resets selection when navigating to the next page", async () => {
    const screen = await renderWithProviders(<StravaImportPage />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Morning Run/ }),
    );
    await expect.element(screen.getByText("1 selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await expect.element(screen.getByText("Long Run")).toBeInTheDocument();
    await expect.element(screen.getByText(/selected/)).not.toBeInTheDocument();
  });

  it("import button not shown when nothing selected", async () => {
    const screen = await renderWithProviders(<StravaImportPage />);

    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /import selected/i }),
    ).not.toBeInTheDocument();
  });

  it("happy path: enqueues selected activities and shows queued count", async () => {
    server.use(trpc.strava.importActivities(async () => {}));

    const screen = await renderWithProviders(<StravaImportPage />);
    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Morning Run/ }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Evening Jog/ }),
    );
    await expect.element(screen.getByText("2 selected")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /import selected/i }),
    );

    await expect
      .element(screen.getByText("2 activities queued for import"))
      .toBeInTheDocument();
    expect(trpc.strava.importActivities.mock.calls[0]![0]).toEqual({
      activityIds: expect.arrayContaining([1, 2]),
    });
  });

  it("imported rows are dimmed and deselected after import", async () => {
    server.use(trpc.strava.importActivities(async () => {}));

    const screen = await renderWithProviders(<StravaImportPage />);
    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Morning Run/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /import selected/i }),
    );

    await expect
      .element(screen.getByText("1 activity queued for import"))
      .toBeInTheDocument();

    const morningRunRow = screen
      .getByText("Morning Run")
      .element()
      .closest("li")!;
    expect(morningRunRow.className).toMatch(/opacity-50/);

    const eveningJogRow = screen
      .getByText("Evening Jog")
      .element()
      .closest("li")!;
    expect(eveningJogRow.className).not.toMatch(/opacity-50/);
  });

  it("import failure shows an error via throwOnError", async () => {
    server.use(
      trpc.strava.importActivities(() => {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }),
    );

    const screen = await renderWithProviders(<StravaImportPage />);
    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Morning Run/ }),
    );

    await expect
      .element(screen.getByRole("button", { name: /import selected/i }))
      .toBeInTheDocument();
  });
});
