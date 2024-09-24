import { formatDuration } from './format';
import { Duration } from 'luxon';

export default function DurationText(
  params: { seconds: number } | { duration: Duration },
) {
  const seconds =
    'seconds' in params ? params.seconds : params.duration.as('seconds');
  const [value, unit] = formatDuration(seconds);
  return (
    <span>
      {value}
      {unit}
    </span>
  );
}
