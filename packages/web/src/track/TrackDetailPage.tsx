import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

import type { Point } from "@pt/shared";

import type { RecordedTrack } from "../../../api/src/track/track.service";
import { decodePolyline } from "../../../shared/src/polyline";
import { AppMap } from "@/components/map";
import { type AppUseQueryResult, useTRPC } from "@/trpc";

export default function TrackDetailPage() {
  const id = useParams().trackID!;
  const query = useTrackDetailQuery(id);

  const geojson = useMemo(() => {
    if (!query.data) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: query.data.coordinates,
      },
      properties: {},
    } as const;
  }, [query.data]);

  return (
    <div className="mx-auto w-full max-w-4xl p-8">
      <h1 className="mb-4 text-2xl font-bold">Track Detail</h1>
      {query.isLoading && <p>Loading...</p>}
      {query.data && (
        <div className="rounded border p-4">
          <p className="font-semibold">{query.data.name}</p>
          <p className="text-sm text-gray-600">
            Recorded at {new Date(query.data.createdAt).toLocaleString()}
          </p>
        </div>
      )}
      <AppMap
        className="mt-4 h-[400px] rounded"
        geojson={geojson}
        initialCamera="fit"
      />
    </div>
  );
}

type HydratedRecordedTrack = RecordedTrack & {
  coordinates: Point[];
};

function useTrackDetailQuery(
  id: string,
): AppUseQueryResult<HydratedRecordedTrack | null> {
  const trpc = useTRPC();
  return useQuery(
    trpc.track.getRecordedTrack.queryOptions(
      { id },
      {
        select: selectHydratedRecordedTrack,
      },
    ),
  );
}

function selectHydratedRecordedTrack(
  data: RecordedTrack | null,
): HydratedRecordedTrack | null {
  if (!data) return null;
  return {
    ...data,
    coordinates: decodePolyline(data.polyline),
  };
}
