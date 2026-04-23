import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LocalRecordedTrack, LocalRecordedTrackPoint } from "@pt/shared";

import { NativeRequiredError } from "../AppError.js";
import { AppMap, type MapManager } from "../components/map/index.js";
import { type RecordTrackState, RecordTrackStateSchema } from "./types.js";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle.js";

function trackToGeoJSON(recording: LocalRecordedTrack): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: { stroke: "#2a82b2", "stroke-width": 3 },
    geometry: {
      type: "LineString",
      coordinates: recording.points.map(p => [p.longitude, p.latitude]),
    },
  };
}

function jumpToPoint(manager: MapManager, point: LocalRecordedTrackPoint) {
  manager.jumpTo({ center: [point.longitude, point.latitude], zoom: 13 });
}

export default function RecordTrackPage() {
  if (!window.Native) throw new NativeRequiredError();

  usePageTitle("Record Track");

  const managerRef = useRef<MapManager | null>(null);
  const pendingJumpRef = useRef<LocalRecordedTrackPoint | null>(null);
  const onManager = useCallback((m: MapManager) => {
    managerRef.current = m;
    if (pendingJumpRef.current) {
      jumpToPoint(m, pendingJumpRef.current);
    }
  }, []);

  const [state, setState] = useState<RecordTrackState | null>(null);

  useEffect(() => {
    let centeredForRecordingId: string | undefined;
    window.onRecordTrackState = raw => {
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
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <AppMap geojson={geojson} onManager={onManager} />
      </div>

      <div className="flex items-center justify-between gap-4 border-t p-4">
        {state.recording ? (
          <>
            <div className="text-muted-foreground text-sm">
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
            onClick={() => window.Native!.startRecordingTrack()}>
            Start Recording
          </Button>
        )}
      </div>
    </div>
  );
}
