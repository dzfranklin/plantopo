import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { SummaryActivity } from "../../../api/src/strava/strava.api";
import { DistanceView, DurationView, InstantView } from "@/components/format";
import { Checkbox } from "@/components/ui/checkbox";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTRPC } from "@/trpc";
import { cn } from "@/util/cn";

export default function StravaImportPage() {
  usePageTitle("Import from Strava");

  const [searchParams] = useSearchParams();
  const cursor = searchParams.get("cursor") ?? undefined;

  return <ActivityPage key={cursor ?? ""} cursor={cursor} />;
}

function ActivityPage({ cursor }: { cursor: string | undefined }) {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const query = useQuery(trpc.strava.listActivities.queryOptions({ cursor }));
  const activities = query.data?.activities;

  const nextCursor = query.data?.nextCursor ?? null;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState<Set<number>>(new Set());

  const importMutation = useMutation(
    trpc.strava.importActivities.mutationOptions({
      onSuccess: () => {
        setImported(prev => new Set([...prev, ...selected]));
        setSelected(new Set());
      },
    }),
  );

  const allIds = useMemo(() => activities?.map(a => a.id) ?? [], [activities]);

  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = !allSelected && allIds.some(id => selected.has(id));

  const toggleAll = useCallback(() => {
    if (allSelected || someSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }, [allSelected, someSelected, allIds]);

  const toggleOne = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const goToPage = useCallback(
    (c: string | null) => {
      setSearchParams(c ? { cursor: c } : {}, { replace: false });
    },
    [setSearchParams],
  );

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
            importedIds={imported}
            onImport={() =>
              importMutation.mutate({ activityIds: [...selected] })
            }
            isImporting={importMutation.isPending}
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
                  imported={imported.has(activity.id)}
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
  importedIds,
  onImport,
  isImporting,
}: {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  importedIds: Set<number>;
  onImport: () => void;
  isImporting: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-gray-200 bg-white px-4 py-2">
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
      {selectedCount > 0 && (
        <button
          className="ml-auto rounded bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          disabled={isImporting}
          onClick={onImport}>
          {isImporting ? "Importing…" : "Import selected"}
        </button>
      )}
      {importedIds.size > 0 && selectedCount === 0 && (
        <span className="text-sm text-green-600">
          {importedIds.size}{" "}
          {importedIds.size === 1 ? "activity" : "activities"} queued for import
        </span>
      )}
    </div>
  );
}

function ActivityRow({
  activity,
  selected,
  imported,
  onToggle,
}: {
  activity: SummaryActivity;
  selected: boolean;
  imported: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <li
      className={cn(
        "flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50",
        selected && "bg-blue-50 hover:bg-blue-50",
        imported && "opacity-50",
      )}
      onClick={() => onToggle(activity.id)}>
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggle(activity.id)}
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
    </li>
  );
}
