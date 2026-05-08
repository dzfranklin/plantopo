import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { ActivityWithStatus } from "@pt/api";

import { DistanceView, DurationView, InstantView } from "@/components/format";
import { Checkbox } from "@/components/ui/checkbox";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTRPC } from "@/trpc";
import { cn } from "@/util/cn";

type ImportStatus = ActivityWithStatus["importStatus"];

export default function StravaImportPage() {
  usePageTitle("Import from Strava");

  const [searchParams] = useSearchParams();
  const cursor = searchParams.get("cursor") ?? undefined;

  return <ActivityPage key={cursor ?? ""} cursor={cursor} />;
}

function ActivityPage({ cursor }: { cursor: string | undefined }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const queryOptions = trpc.strava.listActivities.queryOptions({ cursor });

  const query = useQuery({
    ...queryOptions,
    refetchInterval: query =>
      query.state.data?.activities.some(a => a.importStatus === "pending")
        ? 3000
        : false,
  });

  const activities = query.data?.activities;

  const nextCursor = query.data?.nextCursor ?? null;
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const selectableIds =
    activities?.filter(a => a.importStatus !== "pending").map(a => a.id) ?? [];

  const allSelected =
    selectableIds.length > 0 && selectableIds.every(id => selected.has(id));
  const someSelected =
    !allSelected && selectableIds.some(id => selected.has(id));

  const toggleAll = () => {
    if (allSelected || someSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  };

  const toggleOne = (a: ActivityWithStatus) => {
    if (a.importStatus === "pending") return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(a.id)) next.delete(a.id);
      else next.add(a.id);
      return next;
    });
  };

  const hasPreexisting = activities?.some(
    a => selected.has(a.id) && a.importStatus !== "none",
  );
  const [forceRefetchState, setForceRefetch] = useState<boolean>(false);
  const forceRefetch = hasPreexisting ? forceRefetchState : undefined;

  const importMutation = useMutation(
    trpc.strava.importActivities.mutationOptions({
      onSuccess: (_data, vars) => {
        const ids = new Set(vars.activityIds);
        queryClient.setQueryData(queryOptions.queryKey, data =>
          data
            ? {
                ...data,
                activities: data.activities.map(a =>
                  ids.has(a.id)
                    ? { ...a, importStatus: "pending" as const }
                    : a,
                ),
              }
            : data,
        );
        setSelected(new Set());
      },
    }),
  );

  const handleImport = () => {
    importMutation.mutate({ activityIds: [...selected], forceRefetch });
  };

  const goToPage = (c: string | null) => {
    setSearchParams(c ? { cursor: c } : {}, { replace: false });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="px-4 pb-8">
        <h1 className="mb-4 pt-6 text-2xl font-bold">Import from Strava</h1>

        <div>
          <BulkToolbar
            selectedCount={selected.size}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleAll={toggleAll}
            onImport={handleImport}
            isImporting={importMutation.isPending}
            forceRefetch={forceRefetch}
            setForceRefetch={setForceRefetch}
          />

          {query.isLoading && (
            <p className="text-sm text-gray-500">Loading...</p>
          )}

          {query.isError && (
            <p className="text-sm text-red-600">
              Failed to load activities. Please try again.
            </p>
          )}

          {!query.isLoading && activities?.length === 0 && !query.isError && (
            <p className="text-sm text-gray-500">No activities found.</p>
          )}

          {activities && activities.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded border border-gray-200">
              {activities.map(activity => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  selected={selected.has(activity.id)}
                  onToggle={toggleOne}
                />
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              className="text-blue-600 not-disabled:hover:underline disabled:text-gray-400"
              disabled={!cursor}
              onClick={() => navigate(-1)}>
              ← Previous
            </button>
            <button
              className="text-blue-600 not-disabled:hover:underline disabled:text-gray-400"
              disabled={!nextCursor}
              onClick={() => goToPage(nextCursor)}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkToolbar({
  selectedCount,
  allSelected,
  someSelected,
  onToggleAll,
  onImport,
  isImporting,
  forceRefetch,
  setForceRefetch,
}: {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onImport: () => void;
  isImporting: boolean;
  forceRefetch: boolean | undefined;
  setForceRefetch: (force: boolean) => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex min-h-12 items-end gap-3 border-gray-200 bg-white px-4 py-2">
      <label className="flex min-w-48 items-center gap-2 select-none">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={onToggleAll}
          aria-label="Select all activities"
        />
        <span className="text-sm text-gray-600">
          {selectedCount > 0
            ? `${selectedCount} selected`
            : "Select activities to import"}
        </span>
      </label>
      <div
        aria-hidden={selectedCount === 0}
        className={cn(
          "ml-auto flex items-end gap-4 transition-opacity",
          selectedCount === 0 && "opacity-0",
        )}>
        <label
          className={cn(
            "text-muted-foreground flex cursor-pointer items-center gap-2 text-sm transition-opacity select-none",
            forceRefetch === undefined && "opacity-0",
          )}>
          <Checkbox
            checked={forceRefetch ?? false}
            onCheckedChange={setForceRefetch}
          />{" "}
          Force re-import existing
        </label>

        <button
          className="ml-auto rounded bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          disabled={isImporting}
          onClick={onImport}>
          {isImporting ? "Importing…" : "Import selected"}
        </button>
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<Exclude<ImportStatus, "none">, string> = {
  pending: "Importing…",
  done: "Imported",
  track_deleted: "Track deleted",
};

function ActivityRow({
  activity,
  selected,
  onToggle,
}: {
  activity: ActivityWithStatus;
  selected: boolean;
  onToggle: (a: ActivityWithStatus) => void;
}) {
  const { importStatus } = activity;
  const isBlocked = importStatus === "pending";
  const isMuted = importStatus === "done" || importStatus === "track_deleted";
  const badge = importStatus !== "none" ? STATUS_BADGE[importStatus] : null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-sm transition-all",
        isBlocked
          ? "cursor-default opacity-50"
          : "cursor-pointer hover:bg-gray-50",
        isMuted && "opacity-50",
        selected && "bg-blue-50 hover:bg-blue-50",
      )}
      onClick={() => onToggle(activity)}>
      <Checkbox
        checked={selected}
        disabled={isBlocked}
        onCheckedChange={() => onToggle(activity)}
        onClick={e => e.stopPropagation()}
        aria-label={`Select ${activity.name}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{activity.name}</p>
        <p className="text-xs text-gray-500">
          <span className="capitalize">
            {activity.sport_type.toLowerCase().replace(/_/g, " ")}
          </span>
          {" · "}
          <InstantView date={activity.start_date_local} />
          {!activity.manual && (
            <>
              {" · "}
              <DistanceView m={activity.distance} />
              {" · "}
              <DurationView ms={activity.moving_time * 1000} />
            </>
          )}
        </p>
      </div>
      {badge && <span className="shrink-0 text-xs text-gray-400">{badge}</span>}
    </li>
  );
}
