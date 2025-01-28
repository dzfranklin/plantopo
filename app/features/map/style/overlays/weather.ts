import { DynamicOverlayStyle } from '@/features/map/style';
import { z } from 'zod';
import { wait } from '@/time';
import { DateTime } from 'luxon';
import { zDate, zDateTime } from '@/parsing';

const base: Partial<DynamicOverlayStyle> = {
  sources: {
    default: {
      type: 'raster',
      url: '__URL__',
    },
  },
  layers: [
    {
      id: 'raster',
      type: 'raster',
      source: 'default',
      paint: {
        'raster-resampling': 'nearest',
        'raster-opacity': 0.8,
      },
    },
  ],
};

const metaCache = new Map<string, Promise<unknown>>();

// Fetches json metadata, coalescing in-flight requests and caching successful
// responses.
//
// You can call with different `spec`s for the same `url`.
async function fetchMeta<S extends z.ZodType>(
  url: string,
  spec: S,
): Promise<z.infer<S>> {
  if (metaCache.has(url)) {
    let cached;
    let cachedErr = false;
    try {
      cached = await metaCache.get(url)!;
    } catch (err) {
      cachedErr = true;
    }

    if (!cachedErr) {
      try {
        return spec.parse(cached);
      } catch (err) {
        metaCache.delete(url);
        console.error('failed to parse cached', err);
      }
    }
  }

  const p = (async (): Promise<[unknown, z.infer<S>]> => {
    let lastErr;
    for (let tryN = 0; tryN < 4; tryN++) {
      await wait((tryN - 1) * 500);

      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          throw new Error(`status ${resp.status}`);
        }
        const respJSON = await resp.json();

        return [respJSON, spec.parse(respJSON)];
      } catch (err) {
        lastErr = new Error(`failed to fetch ${url}: ${err}`);
        console.error(lastErr);
      }
    }
    throw lastErr;
  })();

  metaCache.set(
    url,
    p.then(([respJSON]) => respJSON),
  );

  try {
    const [_json, parsed] = await p;
    return parsed;
  } catch (err) {
    metaCache.delete(url);
    throw err;
  }
}

function datetimeLabel(ts: DateTime): string {
  return ts.toLocaleString(DateTime.DATETIME_SHORT);
}

function dateLabel(ts: DateTime): string {
  return ts.toLocaleString(DateTime.DATE_SHORT);
}

export const weatherOverlays: DynamicOverlayStyle[] = [
  {
    ...base,
    id: 'icon_eu_h_snow',
    name: 'Snow Depth Forecast',
    details:
      'Snow depth forecast by ICON-EU (~7km resolution) from Deutscher Wetterdienst. In metres. Updated every day around 4am UTC.',
    region: 'Europe',
    legendURL: 'https://plantopo-weather.b-cdn.net/icon_eu_h_snow/legend.html',
    dynamic: async () => {
      const meta = await fetchMeta(
        'https://plantopo-weather.b-cdn.net/icon_eu_h_snow/meta.json',
        z.object({
          modelRun: zDateTime,
          versionMessage: z.string(),
          hours: z
            .object({
              hour: z.number(),
              tilejson: z.string().url(),
            })
            .array(),
        }),
      );
      return {
        versionMessage: meta.versionMessage,
        variables: {
          URL: {
            type: 'select',
            label: 'Time',
            options: meta.hours.map((v) => ({
              name: datetimeLabel(meta.modelRun.plus({ hours: v.hour })),
              value: v.tilejson,
            })),
          },
        },
      };
    },
  },
  {
    ...base,
    id: 'met_scotland_daytime_average_precipitation_accumulation',
    name: 'Daytime Precipitation',
    region: 'Scotland',
    details:
      'Daytime (6am - 6pm) precipitation accumulation in average mm/hr. Computed from the Met Office UK 2km model. Updated every day around 5:30am UTC.',
    legendURL:
      'https://plantopo-weather.b-cdn.net/met_scotland_daytime_average_precipitation_accumulation/legend.html',
    dynamic: async () => {
      const meta = await fetchMeta(
        'https://plantopo-weather.b-cdn.net/met_scotland_daytime_average_precipitation_accumulation/meta.json',
        z.object({
          modelRun: zDateTime,
          versionMessage: z.string(),
          dates: z
            .object({
              date: zDate,
              tilejson: z.string().url(),
            })
            .array(),
        }),
      );
      return {
        versionMessage: meta.versionMessage,
        variables: {
          URL: {
            type: 'select',
            label: 'Day',
            options: meta.dates.map((v) => ({
              name: dateLabel(v.date),
              value: v.tilejson,
            })),
          },
        },
      };
    },
  },
  {
    ...base,
    id: 'met_scotland_temperature_daytime_min',
    name: 'Daytime Low Temperature',
    region: 'Scotland',
    details:
      'Daytime (6am - 6pm) low temperature in degrees celsius. Computed from the Met Office UK 2km model. Updated every day around 5:30am UTC.',
    legendURL:
      'https://plantopo-weather.b-cdn.net/met_scotland_temperature/legend.html',
    dynamic: async () => {
      const meta = await fetchMeta(
        'https://plantopo-weather.b-cdn.net/met_scotland_temperature/meta.json',
        z.object({
          modelRun: zDateTime,
          versionMessage: z.string(),
          dates: z
            .object({
              date: zDate,
              daytime_min_tilejson: z.string().url(),
            })
            .array(),
        }),
      );
      return {
        versionMessage: meta.versionMessage,
        variables: {
          URL: {
            type: 'select',
            label: 'Day',
            options: meta.dates.map((v) => ({
              name: dateLabel(v.date),
              value: v.daytime_min_tilejson,
            })),
          },
        },
      };
    },
  },
  {
    ...base,
    id: 'met_scotland_temperature_daytime_max',
    name: 'Daytime High Temperature',
    region: 'Scotland',
    details:
      'Daytime (6am - 6pm) high temperature in degrees celsius. Computed from the Met Office UK 2km model. Updated every day around 5:30am UTC.',
    legendURL:
      'https://plantopo-weather.b-cdn.net/met_scotland_temperature/legend.html',
    dynamic: async () => {
      const meta = await fetchMeta(
        'https://plantopo-weather.b-cdn.net/met_scotland_temperature/meta.json',
        z.object({
          modelRun: zDateTime,
          versionMessage: z.string(),
          dates: z
            .object({
              date: zDate,
              daytime_max_tilejson: z.string().url(),
            })
            .array(),
        }),
      );
      return {
        versionMessage: meta.versionMessage,
        variables: {
          URL: {
            type: 'select',
            label: 'Day',
            options: meta.dates.map((v) => ({
              name: dateLabel(v.date),
              value: v.daytime_max_tilejson,
            })),
          },
        },
      };
    },
  },
  {
    ...base,
    id: 'met_scotland_temperature_nighttime_min',
    name: 'Nighttime Low Temperature',
    region: 'Scotland',
    details:
      'Nighttime (6pm - 6am the next day) low temperature in degrees celsius. Computed from the Met Office UK 2km model. Updated every day around 5:30am UTC.',
    legendURL:
      'https://plantopo-weather.b-cdn.net/met_scotland_temperature/legend.html',
    dynamic: async () => {
      const meta = await fetchMeta(
        'https://plantopo-weather.b-cdn.net/met_scotland_temperature/meta.json',
        z.object({
          modelRun: zDateTime,
          versionMessage: z.string(),
          dates: z
            .object({
              date: zDate,
              nighttime_min_tilejson: z.string().url().optional(),
            })
            .array(),
        }),
      );
      return {
        versionMessage: meta.versionMessage,
        variables: {
          URL: {
            type: 'select',
            label: 'Day',
            options: meta.dates
              .filter((v) => v.nighttime_min_tilejson)
              .map((v) => ({
                name: dateLabel(v.date),
                value: v.nighttime_min_tilejson!,
              })),
          },
        },
      };
    },
  },
  {
    ...base,
    id: 'met_scotland_temperature_nighttime_max',
    name: 'Nighttime High Temperature',
    region: 'Scotland',
    details:
      'Nighttime (6pm - 6am the next day) high temperature in degrees celsius. Computed from the Met Office UK 2km model. Updated every day around 5:30am UTC.',
    legendURL:
      'https://plantopo-weather.b-cdn.net/met_scotland_temperature/legend.html',
    dynamic: async () => {
      const meta = await fetchMeta(
        'https://plantopo-weather.b-cdn.net/met_scotland_temperature/meta.json',
        z.object({
          modelRun: zDateTime,
          versionMessage: z.string(),
          dates: z
            .object({
              date: zDate,
              nighttime_max_tilejson: z.string().url().optional(),
            })
            .array(),
        }),
      );
      return {
        versionMessage: meta.versionMessage,
        variables: {
          URL: {
            type: 'select',
            label: 'Day',
            options: meta.dates
              .filter((v) => v.nighttime_max_tilejson)
              .map((v) => ({
                name: dateLabel(v.date),
                value: v.nighttime_max_tilejson!,
              })),
          },
        },
      };
    },
  },
  {
    ...base,
    id: 'met_scotland_wind_gust_daytime_max',
    name: 'Daytime Wind Gust',
    region: 'Scotland',
    details:
      'Daytime (6am - 6pm) max wind gust in mph. Computed from the Met Office UK 2km model. Updated every day around 5:30am UTC.',
    legendURL:
      'https://plantopo-weather.b-cdn.net/met_scotland_wind_gust/legend.html',
    dynamic: async () => {
      const meta = await fetchMeta(
        'https://plantopo-weather.b-cdn.net/met_scotland_wind_gust/meta.json',
        z.object({
          modelRun: zDateTime,
          versionMessage: z.string(),
          dates: z
            .object({
              date: zDate,
              daytime_max_tilejson: z.string().url(),
            })
            .array(),
        }),
      );
      return {
        versionMessage: meta.versionMessage,
        variables: {
          URL: {
            type: 'select',
            label: 'Day',
            options: meta.dates.map((v) => ({
              name: dateLabel(v.date),
              value: v.daytime_max_tilejson,
            })),
          },
        },
      };
    },
  },
  {
    ...base,
    id: 'met_scotland_wind_gust_nighttime_max',
    name: 'Nighttime Wind Gust',
    region: 'Scotland',
    details:
      'Nighttime (6pm - 6am the next day) max wind gust in mph. Computed from the Met Office UK 2km model. Updated every day around 5:30am UTC.',
    legendURL:
      'https://plantopo-weather.b-cdn.net/met_scotland_wind_gust/legend.html',
    dynamic: async () => {
      const meta = await fetchMeta(
        'https://plantopo-weather.b-cdn.net/met_scotland_wind_gust/meta.json',
        z.object({
          modelRun: zDateTime,
          versionMessage: z.string(),
          dates: z
            .object({
              date: zDate,
              nighttime_max_tilejson: z.string().url().optional(),
            })
            .array(),
        }),
      );
      return {
        versionMessage: meta.versionMessage,
        variables: {
          URL: {
            type: 'select',
            label: 'Day',
            options: meta.dates
              .filter((v) => v.nighttime_max_tilejson)
              .map((v) => ({
                name: dateLabel(v.date),
                value: v.nighttime_max_tilejson!,
              })),
          },
        },
      };
    },
  },
];
