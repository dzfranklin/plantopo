import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { decodePolyline } from "../../../shared/src/polyline";
import { AppMap } from "@/components/map";
import { useTRPC } from "@/trpc";

export default function TrackDetailPage() {
  const id = useParams().trackID!;
  const trpc = useTRPC();
  const query = useQuery(trpc.track.getRecordedTrack.queryOptions({ id }));

  const geojson = useMemo(() => {
    if (!query.data) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: decodePolyline(query.data.polyline),
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
