import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import { useMemo, useRef, useState } from "react";

import { type Point2, add2, createSeededRandom, round2 } from "@pt/shared";

import ElevationChart from "@/components/ElevationChart";
import { Input } from "@/components/ui/input";

export default function DevElevationChartPage() {
  const [seed, setSeed] = useState(1);
  const [minE, setMinE] = useState(121);
  const [maxE, setMaxE] = useState(846);
  const [dFactor, setDFactor] = useState(1);
  const [nullPct, setNullPct] = useState(0);
  const inspectRef = useRef<HTMLPreElement>(null);

  const data =
    maxE - minE > 0.001
      ? generateData(seed, minE, maxE, dFactor, nullPct)
      : null;

  const totalDistance = useMemo(
    () =>
      data?.points ? length(lineString(data?.points), { units: "meters" }) : 0,
    [data?.points],
  );

  const onPointHover = (point: Point2 | null) => {
    if (!inspectRef.current) return;
    inspectRef.current.textContent = JSON.stringify(point, null);
  };

  return (
    <div className="m-4 mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex-baseline flex flex-wrap gap-4">
        <label className="flex items-baseline gap-1">
          <span className="mr-2 block shrink-0 text-sm font-medium">Seed</span>
          <Input
            className="max-w-16"
            type="number"
            value={seed}
            onChange={e => setSeed(Number(e.target.value))}
          />
        </label>
        <label className="flex items-baseline gap-1">
          <span className="mr-2 block shrink-0 text-sm font-medium">
            Elevation range
          </span>
          <Input
            type="number"
            className="max-w-24"
            value={minE}
            onChange={e => setMinE(Number(e.target.value))}
            aria-invalid={minE >= maxE}
          />
          <span className="mx-1 text-sm">to</span>
          <Input
            className="max-w-24"
            type="number"
            value={maxE}
            onChange={e => setMaxE(Number(e.target.value))}
            aria-invalid={maxE <= minE}
          />
        </label>
        <label className="flex items-baseline gap-1">
          <span className="mr-2 block shrink-0 text-sm font-medium">
            Distance factor
          </span>
          <Input
            className="max-w-16"
            type="number"
            value={dFactor}
            onChange={e => setDFactor(Number(e.target.value))}
          />
        </label>
        <label className="flex items-baseline gap-1">
          <span className="mr-2 block flex-0 shrink-0 text-sm font-medium">
            Null elevations
          </span>
          <Input
            className="max-w-16"
            type="number"
            value={nullPct}
            min={0}
            max={100}
            onChange={e => setNullPct(Number(e.target.value))}
          />
          %
        </label>
      </div>

      <div className="text-muted-foreground text-sm">
        Total distance: {(totalDistance / 1000).toFixed(2)} km
      </div>

      {data && (
        <ElevationChart
          {...data}
          onPointHover={onPointHover}
          className="h-[200px] w-full"
        />
      )}

      <pre
        ref={inspectRef}
        className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs"
      />
    </div>
  );
}

function generateData(
  seed: number,
  minE: number,
  maxE: number,
  dFactor: number,
  nullPct: number,
) {
  const rng = createSeededRandom(seed);
  const originT = new Date("2026-04-24T15:25:40.387Z").getTime();
  const originLng = -2.4;
  const originLat = 57;

  const points: Point2[] = [];
  const elevations = [];
  const timestamps = [];
  for (let i = 0; i < 1000; i++) {
    const lastPoint = points[points.length - 1] ?? [originLng, originLat];
    points.push(
      round2(
        add2(lastPoint, [rng() * 0.001 * dFactor, rng() * 0.0001 * dFactor]),
        6,
      ),
    );

    if (rng() < nullPct / 100) {
      elevations.push(null);
    } else {
      elevations.push(
        ((Math.sin(i / 100 + (rng() - 0.5) / 6) + 1) / 2) * (maxE - minE) +
          minE,
      );
    }

    timestamps.push(originT + i * 1000 + 60 * rng());
  }
  return { points, elevations, timestamps };
}
