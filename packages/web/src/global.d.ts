const { RecordTrackState } = import("./record-track/types.js");

interface Window {
  enableDevtools?: () => void;

  Native?: {
    logout: () => void;
    recordTrackReady: () => void;
    startRecordingTrack: () => void;
    stopRecordingTrack: () => void;
  };

  onRecordTrackState?: ((state: RecordTrackState) => void) | undefined;
}
