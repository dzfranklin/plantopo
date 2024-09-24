import DistanceText from '@/features/units/DistanceText';
import DurationText from '@/features/units/DurationText';
import Skeleton from '@/components/Skeleton';
import { Timestamp } from '@/components/Timestamp';
import { DateTime } from 'luxon';
import { TrackUpdate } from '@/features/tracks/schema';
import { Dispatch } from 'react';
import { Input } from '@/components/input';
import { useTrackQuery } from '@/features/tracks/queries';

export default function TrackStatsComponent({
  id,
  edit,
  updateEdit,
}: {
  id: string;
  edit?: TrackUpdate | null;
  updateEdit?: Dispatch<TrackUpdate>;
}) {
  const query = useTrackQuery(id);

  if (!query.data) {
    return <Skeleton height="5rem" />;
  }
  const track = query.data.track;

  const date = edit?.date ?? track.date;

  return (
    <dl className="flex gap-12">
      <StatComponent label="Length">
        <DistanceText meters={track.lengthMeters} />
      </StatComponent>

      {track.durationSecs !== undefined && (
        <StatComponent label="Duration">
          <DurationText seconds={track.durationSecs} />
        </StatComponent>
      )}

      <StatComponent label="Date">
        {edit && updateEdit ? (
          <Input
            type="datetime-local"
            value={
              DateTime.fromISO(date)
                .toLocal()
                .set({ second: 0, millisecond: 0 })
                .toISO({ includeOffset: false }) ?? undefined
            }
            onChange={(e) =>
              updateEdit({
                date:
                  DateTime.fromISO(e.target.value).toUTC().toISO() ?? undefined,
              })
            }
          />
        ) : (
          <Timestamp iso={date} fmt={DateTime.DATETIME_FULL} />
        )}
      </StatComponent>
    </dl>
  );
}

function StatComponent({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-2 text-base font-semibold text-gray-600">{children}</dd>
    </div>
  );
}
