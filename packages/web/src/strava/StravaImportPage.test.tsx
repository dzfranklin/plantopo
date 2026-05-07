import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import type { ActivityListPage } from "@pt/api";

import StravaImportPage from "./StravaImportPage";
import { makeActivityListPage } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { trpc } from "@/test/trpc";

function makeActivity(id: number, name: string) {
  return {
    id,
    name,
    manual: false as const,
    distance: 5000,
    moving_time: 1800,
    elapsed_time: 1900,
    total_elevation_gain: 50,
    sport_type: "Run",
    start_date: "2024-01-01T10:00:00Z",
    start_date_local: "2024-01-01T10:00:00Z",
    timezone: "UTC",
    trainer: false,
    commute: false,
    private: false,
    average_speed: 3,
    start_latlng: null,
    end_latlng: null,
    map: { id: `map${id}`, summary_polyline: null },
    max_speed: 5,
  };
}

const PAGE_1: ActivityListPage = makeActivityListPage({
  activities: [makeActivity(1, "Morning Run"), makeActivity(2, "Evening Jog")],
  nextCursor: "1700000000",
});

const PAGE_2: ActivityListPage = makeActivityListPage({
  activities: [makeActivity(3, "Long Run"), makeActivity(4, "Recovery Run")],
  nextCursor: null,
});

describe("StravaImportPage", () => {
  beforeEach(() => {
    server.use(
      trpc.strava.listActivities(({ cursor }) =>
        cursor === PAGE_1.nextCursor ? PAGE_2 : PAGE_1,
      ),
    );
  });

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
      initialPath: `/strava/import?cursor=${PAGE_1.nextCursor}`,
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
});
