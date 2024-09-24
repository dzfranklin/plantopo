export interface TrackFileUpload {
  id: number;
  file: File;
  contents?: ParsedTrack[];
  parseError?: string;
}

export interface ParsedTrack {
  name: string;
  date?: string;
  times?: string[];
  line: [number, number][];
}
