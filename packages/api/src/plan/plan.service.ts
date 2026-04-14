import z from "zod";

import { decodePolyline, round2 } from "@pt/shared";

import { env } from "../env.js";

export async function completeRouteBetween(
  a: [number, number],
  b: [number, number],
  { signal }: { signal?: AbortSignal } = {},
): Promise<[number, number][]> {
  if (!env.VALHALLA) throw new Error("Valhalla not configured");

  a = round2(a, 6);
  b = round2(b, 6);

  const payload = {
    costing: "pedestrian",
    costing_options: {
      pedestrian: {
        use_ferry: 1,
        use_living_streets: 1,
        use_tracks: 1,
        private_access_penalty: 0,
        destination_only_penalty: 0,
        elevator_penalty: 120,
        service_penalty: 0,
        service_factor: 1,
        shortest: false,
        type: "Foot",
        use_hills: 1,
        walking_speed: 5.1,
        walkway_factor: 1,
        sidewalk_factor: 1,
        alley_factor: 1,
        driveway_factor: 1,
        step_penalty: 0,
        max_hiking_difficulty: 6,
        use_lit: 0,
      },
    },
    locations: [
      { lon: a[0], lat: a[1], type: "break" },
      { lon: b[0], lat: b[1], type: "break" },
    ],
    alternates: 0,
    directions_type: "none",
  };

  const ResponseSchema = z.looseObject({
    error_code: z.number().optional(),
    status_code: z.number().optional(),
    error: z.string().optional(),
    trip: z
      .looseObject({
        legs: z.array(
          z.looseObject({
            shape: z.string(),
          }),
        ),
      })
      .optional(),
  });

  const resp = await fetch(env.VALHALLA + "/route", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
  const body = await resp.json();
  const result = ResponseSchema.parse(body);
  if (result.error_code) {
    const code = result.error_code;
    if ((code >= 150 && code <= 158) || code === 442) {
      return [];
    } else {
      throw new Error(`Valhalla ${result.error_code}: ${result.error}`);
    }
  }
  const trip = result.trip!;

  if (trip.legs.length === 0) return [];
  return decodePolyline(trip.legs[0]!.shape);
}
