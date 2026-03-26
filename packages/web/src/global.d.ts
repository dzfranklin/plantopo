interface Window {
  enableDevtools?: () => void;

  Native?: {
    logout: () => void;
    recordTrackReady: () => void;
    startRecordingTrack: () => void;
    stopRecordingTrack: () => void;
  };

  onRecordTrackState?: ((state: unknown) => void) | undefined;
}
