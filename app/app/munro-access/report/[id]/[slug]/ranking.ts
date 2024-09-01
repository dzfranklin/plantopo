import { ClusterData, ItineraryData } from './report';
import { itineraryDuration, otpTime } from './time';
import { z } from 'zod';

// In hours since preceding midnight
const optimalOutH = 6.5;

export const clusterScoreFeaturesSchema = z.object({
  gap: z.number(),
  duration: z.number(),
  munros: z.number(),
  popularityA: z.number(),
  popularityB: z.number(),
});

export type ClusterScoreFeatures = z.infer<typeof clusterScoreFeaturesSchema>;

export const defaultClusterWeights: ClusterScoreFeatures = {
  gap: 2,
  duration: 1,
  munros: 0.1,
  popularityA: 0.01,
  popularityB: 0.01,
};

const zeros = Object.fromEntries(
  Object.entries(defaultClusterWeights).map(([k]) => [k, 0]),
) as ClusterScoreFeatures;

export function scoreCluster(
  cluster: ClusterData,
): ClusterScoreFeatures | undefined {
  if (
    cluster.journeys.out.itineraries.length === 0 &&
    cluster.journeys.back.itineraries.length === 0
  ) {
    return;
  } else if (
    cluster.journeys.out.itineraries.length === 0 ||
    cluster.journeys.back.itineraries.length === 0
  ) {
    return zeros;
  }

  const out = bestOut(cluster.journeys.out.itineraries);
  const back = bestBack(out, cluster.journeys.back.itineraries);

  const gap = departureTime(back).diff(arrivalTime(out)).as('hour');

  const duration =
    itineraryDuration(out).as('hour') + itineraryDuration(back).as('hour');

  const munros = cluster.to.munros.length;

  const popularityA = Object.values(cluster.to.popularityA).reduce(
    (acc, n) => acc + n,
    0,
  );
  const popularityB = Object.values(cluster.to.popularityB).reduce(
    (acc, n) => acc + n,
    0,
  );

  return { gap, duration, munros, popularityA, popularityB };
}

export function weighClusterScores(
  scores: Array<ClusterScoreFeatures | undefined>,
  weights: ClusterScoreFeatures,
): Array<number | undefined> {
  const byF = Object.fromEntries(
    Object.keys(defaultClusterWeights).map((k) => [k, []]),
  ) as unknown as Record<keyof ClusterScoreFeatures, Array<number | undefined>>;

  for (const score of scores) {
    if (!score) {
      for (const values of Object.values(byF)) {
        values.push(undefined);
      }
      continue;
    }

    for (const [feature, value] of Object.entries(score)) {
      byF[feature as keyof ClusterScoreFeatures].push(value);
    }
  }

  const out: Array<number | undefined> = scores.map(() => undefined);
  for (const [feature, values] of Object.entries(byF)) {
    const weight = weights[feature as keyof ClusterScoreFeatures];

    const sorted = values.toSorted().filter((n) => n !== undefined);
    const clipLow = percentile(sorted, 0.05);
    const clipHigh = percentile(sorted, 0.95);

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (!value) continue;

      const scaled = (value - clipLow) / (clipHigh - clipLow);
      const clipped = Math.min(Math.max(0, scaled), 1);

      if (out[i] === undefined) {
        out[i] = clipped * weight;
      } else {
        out[i]! += clipped * weight;
      }
    }
  }

  return out;
}

// Returns the value at a given percentile in a sorted numeric array.
// "Linear interpolation between closest ranks" method
function percentile(arr: number[], p: number): number {
  // From <https://gist.github.com/IceCreamYou/6ffa1b18c4c8f6aeaad2>
  if (arr.length === 0) return 0;
  if (p <= 0) return arr[0]!;
  if (p >= 1) return arr[arr.length - 1]!;

  const index = (arr.length - 1) * p,
    lower = Math.floor(index),
    upper = lower + 1,
    weight = index % 1;

  if (upper >= arr.length) return arr[lower]!;
  return arr[lower]! * (1 - weight) + arr[upper]! * weight;
}

const departureTime = (it: ItineraryData) => {
  return otpTime(it.legs[0]!.startTime);
};

const arrivalTime = (it: ItineraryData) => {
  return otpTime(it.legs.at(-1)!.endTime);
};

function bestOut(journey: ItineraryData[]): ItineraryData {
  const medianDur = medianItineraryDuration(journey);
  const sorted = journey.sort(
    (a, b) =>
      Math.abs(departureTime(a)!.hour - optimalOutH) -
      Math.abs(departureTime(b)!.hour - optimalOutH),
  );
  for (const journey of sorted) {
    if (itineraryDuration(journey).as('hours') < medianDur + 1) {
      return journey;
    }
  }
  throw new Error('unreachable');
}

function bestBack(out: ItineraryData, journey: ItineraryData[]): ItineraryData {
  const arrival = arrivalTime(out);
  const medianDur = medianItineraryDuration(journey);
  const sorted = journey.sort(
    (a, b) =>
      departureTime(b)!.diff(arrival).as('hours') -
      departureTime(a)!.diff(arrival).as('hours'),
  );
  for (const journey of sorted) {
    if (itineraryDuration(journey).as('hours') < medianDur + 1) {
      return journey;
    }
  }
  throw new Error('unreachable');
}

function medianItineraryDuration(journey: ItineraryData[]): number {
  return medianOf(journey.map((it) => itineraryDuration(it).as('hours')));
}

function medianOf(arr: number[]): number {
  arr.sort((a, b) => a - b);
  const midIdx = Math.floor(arr.length / 2);
  if (arr.length % 2 === 0) {
    return (arr[midIdx - 1]! + arr[midIdx]!) / 2;
  } else {
    return arr[midIdx]!;
  }
}
