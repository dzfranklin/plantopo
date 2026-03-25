import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

import { NativeRequiredError } from "../AppError.js";
import type { RecordTrackState } from "./types.js";

export default function RecordTrack() {
  if (!window.Native) throw new NativeRequiredError();

  const [state, setState] = useState<RecordTrackState | null>(null);

  useEffect(() => {
    window.onRecordTrackState = setState;
    window.Native!.recordTrackReady();
    return () => {
      window.onRecordTrackState = undefined;
    };
  }, []);

  if (!state) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <pre>
        <code>{JSON.stringify(state, null, 2)}</code>
      </pre>

      {state.isRecording ? (
        <Button onClick={() => window.Native!.stopRecordingTrack()}>
          Stop
        </Button>
      ) : (
        <Button onClick={() => window.Native!.startRecordingTrack()}>
          Start
        </Button>
      )}
    </div>
  );
}
