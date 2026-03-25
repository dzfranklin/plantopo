interface Window {
  enableDevtools?: () => void;

  Native?: {
    startRecording: () => void;
    logout: () => void;
  };
}
