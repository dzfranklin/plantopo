import { useQuery } from "@tanstack/react-query";
import { featureCollection, lineString, point } from "@turf/helpers";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

import type { Point2 } from "@pt/shared";

import type { RecordedTrack } from "../../../api/src/track/track.service";
import { decodePolyline } from "../../../shared/src/polyline";
import ElevationChart from "@/components/ElevationChart";
import { formatInstant } from "@/components/format";
import { AppMap } from "@/components/map";
import useAnimationThrottledState from "@/hooks/useAnimationThrottledState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { type AppUseQueryResult, useTRPC } from "@/trpc";

export default function TrackDetailPage() {
  const id = useParams().trackId!;
  const query = useTrackDetailQuery(id);

  usePageTitle(
    query.data
      ? query.data.name
        ? `Track: ${query.data.name}`
        : `Track on ${formatInstant(query.data.startTime, "date")}`
      : "Track",
  );

  const [hoveredPoint, setHoveredPoint] =
    useAnimationThrottledState<Point2 | null>(null);

  const geojson = useMemo(() => {
    if (!query.data) return null;

    const fc = featureCollection<GeoJSON.Geometry>([
      lineString(query.data.coordinates, {
        stroke: "hsl(240 91% 47%)",
        "stroke-width": 5,
      }),
    ]);

    if (hoveredPoint) {
      fc.features.push(
        point(hoveredPoint, {
          "marker-color": "hsl(240 91.2% 90%)",
        }),
      );
    }

    return fc;
  }, [hoveredPoint, query.data]);

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
      {query.data && query.data.pointDemElevation && (
        <ElevationChart
          points={query.data.coordinates}
          elevations={query.data.pointDemElevation}
          timestamps={query.data.pointTimestamps}
          onPointHover={setHoveredPoint}
          className="mt-4 h-[200px] rounded"
        />
      )}
    </div>
  );
}

type HydratedRecordedTrack = RecordedTrack & {
  coordinates: Point2[];
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
