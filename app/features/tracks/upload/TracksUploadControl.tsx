import FileUpload from '@/components/FileUpload';
import { useReducer } from 'react';
import { parseTrackFile } from './parseTrackFile';
import { EditTrackFileUploadControl } from './EditTrackFileUploadControl';
import { ParsedTrack, TrackFileUpload } from './schema';
import { Button } from '@/components/button';
import { TrackCreate } from '@/features/tracks/schema';
import { encodePolyline } from '@/features/tracks/polyline';
import { useCreateTrackMutation } from '@/features/tracks/queries';

interface State {
  nextID: number;
  files: TrackFileUpload[];
}

const initialState: State = { nextID: 1, files: [] };

export type TracksUploadAction =
  | { action: 'reset' }
  | { action: 'add'; payload: File }
  | { action: 'parsed'; payload: { file: File; value: ParsedTrack[] } }
  | { action: 'parse-err'; payload: { file: File; value: string } }
  | { action: 'delete'; payload: File }
  | {
      action: 'edit';
      payload: { file: File; track: number; value: Partial<ParsedTrack> };
    };

function reducer(state: State, action: TracksUploadAction): State {
  switch (action.action) {
    case 'reset':
      return { ...state, files: [] };
    case 'add':
      return {
        ...state,
        nextID: state.nextID + 1,
        files: [{ id: state.nextID, file: action.payload }, ...state.files],
      };
    case 'parsed':
      return {
        ...state,
        files: state.files.map((entry) =>
          entry.file === action.payload.file
            ? { ...entry, contents: action.payload.value }
            : entry,
        ),
      };
    case 'parse-err':
      return {
        ...state,
        files: state.files.map((entry) =>
          entry.file === action.payload.file
            ? { ...entry, parseError: action.payload.value }
            : entry,
        ),
      };
    case 'delete':
      return {
        ...state,
        files: state.files.filter((entry) => entry.file !== action.payload),
      };
    case 'edit':
      return {
        ...state,
        files: state.files.map((entry) =>
          entry.file == action.payload.file
            ? {
                ...entry,
                contents: entry.contents?.map((v, i) =>
                  i === action.payload.track
                    ? { ...v, ...action.payload.value }
                    : v,
                ),
              }
            : entry,
        ),
      };
  }
}

export function TracksUploadControl({ onDone }: { onDone: () => void }) {
  const mutation = useCreateTrackMutation();

  const [state, dispatch] = useReducer(reducer, initialState);
  const canSubmit = state.files.some(
    (f) => f.contents && f.contents.length > 0,
  );

  return (
    <form
      className="w-full max-w-lg"
      onSubmit={(evt) => {
        evt.preventDefault();

        const trackCreates: TrackCreate[] = [];
        for (const file of state.files) {
          for (const track of file.contents ?? []) {
            if (track.date === undefined) {
              throw new Error(
                'Unreachable: field validation should prevent undefined date',
              );
            }

            trackCreates.push({
              name: track.name,
              date: track.date,
              line: encodePolyline(track.line),
              times: track.times,
            });
          }
        }

        mutation.mutate(
          { body: { tracks: trackCreates } },
          {
            onSuccess: () => {
              dispatch({ action: 'reset' });
              onDone();
            },
          },
        );
      }}
    >
      <FileUpload
        multiple={true}
        name="files"
        restrictionsLabel="Supports .gpx"
        accept=".gpx,application/gpx+xml"
        onChange={(evt) => {
          for (const file of evt.currentTarget.files ?? []) {
            dispatch({ action: 'add', payload: file });
            parseTrackFile(file).then(
              (value) =>
                dispatch({ action: 'parsed', payload: { file, value } }),
              (reason) => {
                const msg =
                  reason instanceof Error ? reason.message : reason.toString();
                dispatch({
                  action: 'parse-err',
                  payload: { file, value: msg },
                });
              },
            );
          }
        }}
      />

      <div className="mt-6 flex flex-col gap-6">
        {state.files.map((file) => (
          <EditTrackFileUploadControl
            track={file}
            key={file.id}
            dispatch={dispatch}
          />
        ))}
      </div>

      <div className="flex justify-end mt-6">
        <Button
          color="dark/zinc"
          type="submit"
          disabled={!canSubmit}
          disableWith={mutation.isPending && 'Importing...'}
        >
          Import
        </Button>
      </div>
    </form>
  );
}
