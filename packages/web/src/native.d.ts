interface NativeInterface {
  logout: () => void;
  reportUnauthorized: () => void;
  recordTrackReady: () => void;
  startRecordingTrack: () => void;
  stopRecordingTrack: () => void;
  openNativeDebug: () => void;
}

interface Window {
  Native?: NativeInterface;
  onRecordTrackState?: ((state: unknown) => void) | undefined; // @/track/types.ts RecordTrackState
}
