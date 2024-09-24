import { ParsedTrack, TrackFileUpload } from '@/features/tracks/upload/schema';
import { ByteSizeText } from '@/features/units/ByteSizeText';
import InlineAlert from '@/components/InlineAlert';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { IconButton } from '@/components/button';
import * as Headless from '@headlessui/react';
import { Input } from '@/components/input';
import { DateTime } from 'luxon';
import { Label } from '@/components/fieldset';
import { Dispatch } from 'react';
import DurationText from '@/features/units/DurationText';
import { Divider } from '@/components/divider';
import TrackMapComponent from '@/features/tracks/TrackMapComponent';
import { TracksUploadAction } from '@/features/tracks/upload/TracksUploadControl';

export function EditTrackFileUploadControl({
  track,
  dispatch,
}: {
  track: TrackFileUpload;
  dispatch: Dispatch<TracksUploadAction>;
}) {
  return (
    <div className="bg-slate-200 p-4 rounded">
      <p className="flex mb-4 items-start">
        <span className="flex items-baseline">
          <span className="text-slate-700 font-medium text-sm mr-1.5">
            {track.file.name}
          </span>
          <span className="text-xs text-slate-600">
            (<ByteSizeText bytes={track.file.size} />)
          </span>
        </span>
        <span className="ml-auto -mt-1 -mr-1">
          <IconButton
            onClick={() => dispatch({ action: 'delete', payload: track.file })}
          >
            <XMarkIcon className="h-4 w-4" />
          </IconButton>
        </span>
      </p>

      {track.parseError && (
        <InlineAlert variant="warning">
          Failed to read file
          <InlineAlert.Subtext>Error: {track.parseError}</InlineAlert.Subtext>
        </InlineAlert>
      )}

      {track.contents === undefined && track.parseError === undefined && (
        <div className="h-1.5 w-full bg-blue-200 overflow-hidden rounded">
          <div className="animate-progress w-full h-full bg-blue-600 origin-left-right"></div>
        </div>
      )}

      {track.contents?.map((entry, i) => (
        <div key={i}>
          {i > 0 && <Divider className="mt-6 mb-5" />}
          <ParsedTrackComponent
            track={track}
            entry={entry}
            index={i}
            dispatch={dispatch}
          />
        </div>
      ))}
    </div>
  );
}

function ParsedTrackComponent({
  entry,
  track,
  index,
  dispatch,
}: {
  entry: ParsedTrack;
  track: TrackFileUpload;
  index: number;
  dispatch: Dispatch<TracksUploadAction>;
}) {
  const dispatchEdit = (value: Partial<ParsedTrack>) =>
    dispatch({
      action: 'edit',
      payload: { file: track.file, track: index, value },
    });

  return (
    <div className="flex flex-col gap-3 text-sm text-gray-700">
      <Headless.Field>
        <Label>Name</Label>
        <Input
          value={entry.name}
          onChange={(e) => dispatchEdit({ name: e.target.value })}
        />
      </Headless.Field>

      <Headless.Field>
        <Label>Date</Label>
        <Input
          type="datetime-local"
          required={true}
          value={
            entry.date
              ? (DateTime.fromISO(entry.date)
                  .toLocal()
                  .set({ second: 0, millisecond: 0 })
                  .toISO({ includeOffset: false }) ?? undefined)
              : ''
          }
          onChange={(e) =>
            dispatchEdit({
              date:
                DateTime.fromISO(e.target.value).toUTC().toISO() ?? undefined,
            })
          }
        />
      </Headless.Field>

      <div className="rounded overflow-clip mt-3 h-[300px]">
        <TrackMapComponent line={entry.line} />
      </div>

      <div className="text-gray-600 text-xs">
        {entry.line.length} points.{' '}
        {entry.times === undefined ? (
          <>Points do not have times specified.</>
        ) : (
          <>
            Points have times specified
            {entry.times.length >= 2 && (
              <>
                {' '}
                (
                <DurationText
                  duration={DateTime.fromISO(entry.times.at(-1)!).diff(
                    DateTime.fromISO(entry.times.at(0)!),
                  )}
                />
                )
              </>
            )}
            .
          </>
        )}
      </div>
    </div>
  );
}
