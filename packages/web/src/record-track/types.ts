export interface RecordTrackState {
  isRecording: boolean;
  points: { lat: number; lng: number; timestamp: number }[];
}
