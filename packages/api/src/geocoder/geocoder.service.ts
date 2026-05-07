import { TRPCError } from "@trpc/server";
import z from "zod";

import { PointSchema } from "@pt/shared";

import { CircuitBreaker, CircuitOpenError } from "../circuit-breaker.js";
import { env } from "../env.js";
import { getLog } from "../logger.js";

let photonEndpoint: string;
if (env.PHOTON) {
  photonEndpoint = env.PHOTON;
} else {
  getLog().warn("PHOTON environment variable not set, using public server");
  photonEndpoint = "https://photon.komoot.io";
}

const photonCircuitBreaker = new CircuitBreaker(
  "photon",
  response => response.status === 503,
);

async function photonFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await photonCircuitBreaker.fetch(url, init);
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Geocoding service is temporarily unavailable",
      });
    }
    throw err;
  }
}

const TypeSchema = z.enum([
  "house",
  "street",
  "locality",
  "district",
  "city",
  "county",
  "state",
  "country",
  "other",
]);

export function buildLabel(props: GeocodingFeature["properties"]): string {
  const parts: string[] = [];

  if (props.name) {
    parts.push(props.name);
  } else if (props.street) {
    parts.push(
      props.housenumber ? `${props.housenumber} ${props.street}` : props.street,
    );
  } else if (props.locality) {
    parts.push(props.locality);
  }

  if (props.city && props.city !== parts[0]) {
    parts.push(props.city);
  } else if (props.state && props.state !== parts[0]) {
    parts.push(props.state);
  } else if (props.country) {
    parts.push(props.country);
  }

  return parts.join(", ");
}

const FeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    type: TypeSchema,
    label: z.string().optional(),
    name: z.string().optional(),
    housenumber: z.string().optional(),
    street: z.string().optional(),
    locality: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    county: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    countrycode: z.string().optional(),
    osm_type: z.enum(["N", "W", "R"]).optional(),
    osm_id: z.number().optional(),
    osm_key: z.string().optional(),
    osm_value: z.string().optional(),
  }),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
});

export type GeocodingFeature = z.infer<typeof FeatureSchema>;

function enrichFeature(feature: GeocodingFeature): GeocodingFeature {
  if (feature.properties.label) return feature;
  return {
    ...feature,
    properties: {
      ...feature.properties,
      label: buildLabel(feature.properties),
    },
  };
}

function appendMulti(
  params: URLSearchParams,
  key: string,
  value: string | string[] | undefined,
) {
  if (value === undefined) return;
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) params.append(key, v);
}

const FeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(FeatureSchema),
});

const CommonOptionsSchema = z.object({
  limit: z.number().optional(),
  lang: z.string().nullable().optional(),
  osm_tag: z.union([z.string(), z.array(z.string())]).optional(),
  layer: z.union([z.string(), z.array(z.string())]).optional(),
});

export const GeocodeOptionsSchema = CommonOptionsSchema.extend({
  locationBias: z
    .object({
      point: PointSchema,
      zoom: z.number().optional(),
      scale: z.number().optional(),
    })
    .optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  countrycode: z.union([z.string(), z.array(z.string())]).optional(),
});

export type GeocodeOptions = z.infer<typeof GeocodeOptionsSchema>;

export const ReverseGeocodeOptionsSchema = CommonOptionsSchema;

export type ReverseGeocodeOptions = z.infer<typeof ReverseGeocodeOptionsSchema>;

export async function geocode(
  query: string,
  options: GeocodeOptions = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<GeocodingFeature[]> {
  const params = new URLSearchParams({ q: query });
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.lang !== null) params.set("lang", options.lang ?? "en");
  if (options.locationBias !== undefined) {
    const { point, zoom, scale } = options.locationBias;
    params.set("lon", point[0].toFixed(6));
    params.set("lat", point[1].toFixed(6));
    if (zoom !== undefined) params.set("zoom", String(Math.round(zoom)));
    if (scale !== undefined) params.set("location_bias_scale", String(scale));
  }
  if (options.bbox !== undefined) params.set("bbox", options.bbox.join(","));
  appendMulti(params, "countrycode", options.countrycode);
  appendMulti(params, "osm_tag", options.osm_tag);
  appendMulti(params, "layer", options.layer);

  const url = `${photonEndpoint}/api?${params}`;
  const response = await photonFetch(url, { signal });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Photon geocoding error: ${response.status} ${response.statusText} - ${body}`,
    );
  }
  const data = await response.json();
  const parsed = FeatureCollectionSchema.parse(data);
  return parsed.features.map(enrichFeature);
}

export async function reverseGeocode(
  point: z.infer<typeof PointSchema>,
  options: ReverseGeocodeOptions = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<GeocodingFeature[]> {
  const [lon, lat] = point;
  const params = new URLSearchParams({ lon: String(lon), lat: String(lat) });
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.lang !== null) params.set("lang", options.lang ?? "en");
  appendMulti(params, "osm_tag", options.osm_tag);
  appendMulti(params, "layer", options.layer);
  const url = `${photonEndpoint}/reverse?${params}`;
  const response = await photonFetch(url, { signal });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Photon reverse geocoding error: ${response.status} ${response.statusText} - ${body}`,
    );
  }
  const data = await response.json();
  const parsed = FeatureCollectionSchema.parse(data);
  return parsed.features.map(enrichFeature);
}
