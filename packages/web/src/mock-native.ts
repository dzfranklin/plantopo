export function mockNative(): NativeInterface {
  return {
    version: () => "0.0.0-mock",
    logout: () => {
      alert("App would log out now");
    },
    reportUnauthorized: () => {
      alert("Native.reportUnauthorized called");
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
    spaUpdateAvailable: () => true,
    restart: () => {
      alert("App would restart now");
    },
  };
}
