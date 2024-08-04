import { formatDuration } from './format';

export default function DurationText({ seconds }: { seconds: number }) {
  const [value, unit] = formatDuration(seconds);
  return (
    <span>
      {value} {unit}
    </span>
  );
}
