interface NativeInterface {
  version: () => string;
  logout: () => void;
  reportUnauthorized: () => void;
  recordTrackReady: () => void;
  startRecordingTrack: () => void;
  stopRecordingTrack: () => void;
  openNativeDebug: () => void;
  spaUpdateAvailable: () => boolean;
  restart: () => void;
}

interface Window {
  Native?: NativeInterface;
  onRecordTrackState?: ((state: unknown) => void) | undefined; // @/track/types.ts RecordTrackState
}
