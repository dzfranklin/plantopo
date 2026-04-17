interface Window {
  enableQueryDevtools?: () => void;

  Native?: {
    logout: () => void;
    reportUnauthorized: () => void;
    recordTrackReady: () => void;
    startRecordingTrack: () => void;
    stopRecordingTrack: () => void;
  };

  onRecordTrackState?: ((state: unknown) => void) | undefined;
}
