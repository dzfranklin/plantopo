import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RecordedTrack, RecordedTrackPoint } from "@pt/shared";

import { NativeRequiredError } from "../AppError.js";
import { MapManager, MapView } from "../components/map/index.js";
import { type RecordTrackState, RecordTrackStateSchema } from "./types.js";

function trackToGeoJSON(recording: RecordedTrack): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: { stroke: "#2a82b2", "stroke-width": 3 },
    geometry: {
      type: "LineString",
      coordinates: recording.points.map((p) => [p.longitude, p.latitude]),
    },
  };
}

function jumpToPoint(manager: MapManager, point: RecordedTrackPoint) {
  manager.jumpTo({ center: [point.longitude, point.latitude], zoom: 13 });
}

export default function RecordTrackPage() {
  if (!window.Native) throw new NativeRequiredError();

  const managerRef = useRef<MapManager | null>(null);
  const pendingJumpRef = useRef<RecordedTrackPoint | null>(null);
  const onManager = useCallback((m: MapManager) => {
    managerRef.current = m;
    if (pendingJumpRef.current) {
      jumpToPoint(m, pendingJumpRef.current);
    }
  }, []);

  const [state, setState] = useState<RecordTrackState | null>(null);

  useEffect(() => {
    let centeredForRecordingId: string | undefined;
    window.onRecordTrackState = (raw) => {
      if (import.meta.env.DEV) RecordTrackStateSchema.parse(raw);
      const state = raw as RecordTrackState;

      setState(state);
      const point = state.recording?.points.at(-1);
      if (point && state.recording?.id !== centeredForRecordingId) {
        centeredForRecordingId = state.recording?.id;
        if (managerRef.current) {
          jumpToPoint(managerRef.current, point);
        } else {
          pendingJumpRef.current = point;
        }
      }
    };
    window.Native!.recordTrackReady();
    return () => {
      window.onRecordTrackState = undefined;
    };
  }, []);

  const geojson = useMemo(
    () => (state?.recording ? trackToGeoJSON(state?.recording) : null),
    [state?.recording],
  );

  if (!state) return <div>Loading...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <MapView interactive geojson={geojson} onManager={onManager} />
      </div>

      <div className="p-4 flex items-center justify-between gap-4 border-t">
        {state.recording ? (
          <>
            <div className="text-sm text-muted-foreground">
              <div>{state.recording.name || "Unnamed recording"}</div>
              <div>{state.recording.points.length} points</div>
            </div>
            <Button onClick={() => window.Native!.stopRecordingTrack()}>
              Stop
            </Button>
          </>
        ) : (
          <Button
            className="w-full"
            onClick={() => window.Native!.startRecordingTrack()}
          >
            Start Recording
          </Button>
        )}
      </div>
    </div>
  );
}
