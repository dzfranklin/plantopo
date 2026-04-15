import { useCallback, useMemo, useRef, useState } from "react";

import { type Point, type Point3, round2 } from "@pt/shared";

import { AppMap, type MapManager } from "@/components/map";
import { useTRPCClient } from "@/trpc";

function segmentKeyOf(a: Point, b: Point): string {
  return [a, b].map(p => p.join(",")).join(":");
}

export default function DevCompleteRoutePage() {
  const trpc = useTRPCClient();
  const [controlPoints, setControlPoints] = useState<Point[]>([]);
  const [segments, setSegments] = useState<Record<string, Point3[]>>({});
  const controlPointsRef = useRef<Point[]>([]);

  const onManager = useCallback(
    (manager: MapManager) => {
      manager.on("click", async ev => {
        const newPoint = round2([ev.lngLat.lng, ev.lngLat.lat], 6);
        const prev =
          controlPointsRef.current[controlPointsRef.current.length - 1];
        controlPointsRef.current = [...controlPointsRef.current, newPoint];
        setControlPoints(controlPointsRef.current);
        if (prev) {
          const segment = await trpc.plan.suggestRoute.query({
            a: prev,
            b: newPoint,
          });
          if (segment) {
            setSegments(s => ({
              ...s,
              [segmentKeyOf(prev, newPoint)]: segment,
            }));
          }
        }
      });
    },
    [trpc],
  );

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const controlPointFeatures: GeoJSON.Feature[] = controlPoints.map(p => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: p },
    }));

    const line: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [] },
    };
    for (let i = 0; i + 1 < controlPoints.length; i++) {
      const a = controlPoints[i]!;
      const b = controlPoints[i + 1]!;
      const segment = segments[segmentKeyOf(a, b)];
      // line.geometry.coordinates.push(a);
      if (segment)
        line.geometry.coordinates.push(...(segment as unknown as Point[]));
      else line.geometry.coordinates.push(a, b);
      // if (i === controlPoints.length - 2) line.geometry.coordinates.push(b);
    }

    return {
      type: "FeatureCollection",
      properties: {},
      features: [...controlPointFeatures, line],
    };
  }, [controlPoints, segments]);

  return (
    <div className="h-full">
      <AppMap onManager={onManager} geojson={geojson} hash={true} />
    </div>
  );
}
