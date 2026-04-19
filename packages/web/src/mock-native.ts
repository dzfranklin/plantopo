import { getDebugFlag } from "./hooks/debug-flags";

if (getDebugFlag("mockNative")) {
  window.Native = mockNative();
}

export function mockNative(): NativeInterface {
  return {
    logout: () => {
      console.warn("Native.logout called");
    },
    reportUnauthorized: () => {
      console.warn("Native.reportUnauthorized called");
    },
    recordTrackReady: () => {
      window?.onRecordTrackState?.({ recording: null });
    },
    startRecordingTrack: () => {
      window?.onRecordTrackState?.({
        recording: {
          id: "c9233626-e54d-4bae-9c38-2376d6f6ec47",
          name: null,
          startTime: Date.now(),
          endTime: null,
          status: "RECORDING",
          points: [],
        },
      });
    },
    stopRecordingTrack: () => {
      window?.onRecordTrackState?.({ recording: null });
    },
    openNativeDebug: () => {
      alert("Native debug options would open");
    },
  };
}
