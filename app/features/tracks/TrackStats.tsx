import DistanceText from '@/features/units/DistanceText';
import { Track } from '@/features/tracks/api';
import DurationText from '@/features/units/DurationText';

export default function TrackStatsComponent({ track }: { track: Track }) {
  const props = track.geojson.properties;
  return (
    <dl className="flex gap-16">
      {props.lengthMeters !== undefined && (
        <StatComponent label="Length">
          <DistanceText meters={props.lengthMeters} />
        </StatComponent>
      )}

      {props.durationSecs !== undefined && (
        <StatComponent label="Duration">
          <DurationText seconds={props.durationSecs} />
        </StatComponent>
      )}
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
      <dd className="mt-2 text-base font-semibold text-gray-900">{children}</dd>
    </div>
  );
}
