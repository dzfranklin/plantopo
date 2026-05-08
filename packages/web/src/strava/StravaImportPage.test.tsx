import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { ActivityWithStatus } from "@pt/api";

import StravaImportPage from "./StravaImportPage";
import {
  DEFAULT_ACTIVITY_PAGE_1,
  makeActivityListPageWithStatus,
} from "@/test/handlers";
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
    await expect
      .element(screen.getByLabelText(/select all/i))
      .toBePartiallyChecked();

    await expect.element(screen.getByText("Long Run")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await expect.element(screen.getByText("Long Run")).toBeInTheDocument();

    await expect
      .element(screen.getByLabelText(/select all/i))
      .not.toBeChecked();
  });

  it("import button hidden when nothing selected", async () => {
    const screen = await renderWithProviders(<StravaImportPage />);

    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /import selected/i }).query(),
    ).not.toBeInTheDocument();
  });

  it("happy path", async () => {
    let importStatus: ActivityWithStatus["importStatus"] = "none";
    server.use(
      trpc.strava.importActivities(async () => {
        importStatus = "done";
      }),
    );
    server.use(
      trpc.strava.listActivities(() =>
        makeActivityListPageWithStatus({
          activities: DEFAULT_ACTIVITY_PAGE_1.activities.map(a => ({
            ...a,
            importStatus,
          })),
        }),
      ),
    );

    const screen = await renderWithProviders(<StravaImportPage />);
    await expect.element(screen.getByText("Morning Run")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Morning Run/ }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Evening Jog/ }),
    );
    await expect.element(screen.getByText("2 selected")).toBeInTheDocument();

    vi.useFakeTimers();

    await userEvent.click(
      screen.getByRole("button", { name: /import selected/i }),
    );
    await expect
      .element(screen.getByText("Importing…").first())
      .toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3000);

    await expect
      .element(screen.getByText("Imported").first())
      .toBeInTheDocument();
  });
});
