import { ParsedTrack } from '@/features/tracks/upload/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Plot from '@observablehq/plot';
import { DateTime, Duration } from 'luxon';
import { distance as computeDistance } from '@turf/distance';
import { Subheading } from '@/components/heading';
import { Label } from '@/components/fieldset';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import TrackMapComponent from '@/features/tracks/TrackMapComponent';

/* TODO: ideas
Walking around a small circle at the end many times shouldn't count as not the end.

Maybe take the final point and then walk backward to the last point at least .1km from it?
But that will short count slightly.
 */

export type TrackWithTiming = ParsedTrack & {
  times: NonNullable<ParsedTrack['times']>;
};

interface Segment {
  times: string[];
  line: [number, number][];
}

export function TrackPointsOverTime({ track }: { track: TrackWithTiming }) {
  const [plotDerivative, setPlotDerivative] = useState(false);

  const [startSeg, endSeg] = useMemo(() => {
    let runningDistance = 0;
    const startSeg: Segment = { times: [], line: [] };
    const endSeg: Segment = { times: [], line: [] };

    for (let i = 0; i < track.line.length; i++) {
      if (i > 0) {
        runningDistance += computeDistance(track.line[i - 1]!, track.line[i]!, {
          units: 'meters',
        });
      }
      if (runningDistance > 1000) break;
      startSeg.times.push(track.times[i]!);
      startSeg.line.push(track.line[i]!);
    }

    runningDistance = 0;
    for (let i = track.line.length - 1; i > 0; i--) {
      if (i < track.line.length - 1) {
        runningDistance += computeDistance(track.line[i]!, track.line[i - 1]!, {
          units: 'meters',
        });
      }
      if (runningDistance > 1000) break;
      endSeg.times.push(track.times[i]!);
      endSeg.line.push(track.line[i]!);
    }
    endSeg.times.reverse();
    endSeg.line.reverse();

    return [startSeg, endSeg];
  }, [track]);

  return (
    <div>
      <div className="mb-12">
        <MapOverTime times={track.times} line={track.line} />
      </div>

      <div className="mb-4">
        <CheckboxField>
          <Checkbox
            checked={plotDerivative}
            onChange={(checked) => setPlotDerivative(checked)}
          />
          <Label>Plot distance between track points</Label>
        </CheckboxField>
      </div>

      <div className="mb-4">
        <Subheading className="mb-2">Total</Subheading>
        <DistanceOverTimeChart
          times={track.times}
          line={track.line}
          plotDerivative={plotDerivative}
        />
      </div>

      <div className="mb-4">
        <Subheading className="mb-2">Start</Subheading>
        <DistanceOverTimeChart
          times={startSeg.times}
          line={startSeg.line}
          plotDerivative={plotDerivative}
        />
      </div>

      <div>
        <Subheading className="mb-2">End</Subheading>
        <DistanceOverTimeChart
          times={endSeg.times}
          line={endSeg.line}
          plotDerivative={plotDerivative}
        />
      </div>
    </div>
  );
}

function MapOverTime({
  times,
  line,
}: {
  times: string[];
  line: [number, number][];
}) {
  const [percent, setPercent] = useState(1);

  const { partialLine, cutoff } = useMemo(() => {
    if (times.length < 3) return { partialLine: [], cutoff: 0 };

    const start = DateTime.fromISO(times.at(0)!);
    const end = DateTime.fromISO(times.at(-1)!);

    const cutoff = end.diff(start).as('milliseconds') * percent;

    const partialLine = [];
    for (let i = 0; i < line.length; i++) {
      const t = DateTime.fromISO(times[i]!);
      const elapsed = t.diff(start).as('milliseconds');
      if (elapsed <= cutoff) {
        partialLine.push(line[i]!);
      }
    }

    return { partialLine, cutoff };
  }, [line, times, percent]);

  return (
    <div className="h-[300px]">
      <TrackMapComponent line={partialLine} />

      <div className="w-full flex gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={percent * 100}
          onChange={(evt) =>
            setPercent(parseInt(evt.currentTarget.value) / 100)
          }
          className="grow"
        />

        <span className="w-[8em] text-sm text-right">
          minute {Duration.fromMillis(cutoff).as('minutes').toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function DistanceOverTimeChart({
  times,
  line,
  plotDerivative,
}: {
  times: string[];
  line: [number, number][];
  plotDerivative: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const height = 200;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0]!.contentRect.width),
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!ref.current) return;

    const points: Array<{
      RunningDistance: number;
      Distance: number;
      Time: Date;
    }> = [];
    let runningDistance = 0;
    for (let i = 0; i < line.length; i++) {
      let distance = 0;
      if (i > 0) {
        distance = computeDistance(line[i - 1]!, line[i]!, {
          units: 'meters',
        });
        runningDistance += distance;
      }
      points.push({
        RunningDistance: runningDistance,
        Distance: plotDerivative ? distance : runningDistance,
        Time: DateTime.fromISO(times[i]!).toJSDate(),
      });
    }

    const plot = Plot.plot({
      width,
      height,
      marks: [
        Plot.axisX({ label: 'Time' }),
        Plot.axisY({ label: 'Distance (meters)' }),
        Plot.line(points, { x: 'Time', y: 'Distance' }),
        Plot.tip(
          points,
          Plot.pointer({
            x: 'Time',
            y: 'Distance',
            title: (p) =>
              [
                `Time: ${DateTime.fromJSDate(p.Time).toLocaleString(DateTime.TIME_WITH_SECONDS)}`,
                `Running distance: ${p.RunningDistance.toFixed(2)}m`,
              ].join('\n\n'),
          }),
        ),
      ],
    });
    ref.current.append(plot);

    return () => {
      plot.remove();
    };
  }, [plotDerivative, times, line, width, height]);

  return <div ref={ref} style={{ height }} />;
}
