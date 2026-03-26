import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";

import type { RecordedTrack } from "@pt/shared";

import { NativeRequiredError } from "../AppError.js";
import { MapView } from "../components/map/index.js";
import { type RecordTrackState, RecordTrackStateSchema } from "./types.js";

function trackToGeoJSON(recording: RecordedTrack): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: recording.points.map((p) => [p.longitude, p.latitude]),
    },
  };
}

export default function RecordTrack() {
  if (!window.Native) throw new NativeRequiredError();

  const [state, setState] = useState<RecordTrackState | null>(null);

  useEffect(() => {
    window.onRecordTrackState = (state) => {
      setState(RecordTrackStateSchema.parse(state));
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
        <MapView interactive geojson={geojson} />
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
