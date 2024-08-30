import { components, paths } from '@/api/v1';
import { z } from 'zod';

export type MunroList =
  paths['/munro-access/munros']['get']['responses'][200]['content']['application/json']['munros'];

export type ReportStatus =
  paths['/munro-access/report/{id}/status']['get']['responses']['200']['content']['application/json'];

export type ReportMeta = components['schemas']['MunroAccessReportMeta'];

const pointSchema = z.tuple([z.number(), z.number()]);

export type Point = z.infer<typeof pointSchema>;

interface StopData {
  code?: string | null;
  desc?: string | null;
  locationType: string;
  platformCode?: string | null;
  cluster?: StopData | null;
  parentStation?: {
    name: string;
  } | null;
}

const stopDataSchema: z.ZodSchema<StopData> = z.lazy(() =>
  z.object({
    code: z.string().nullish(),
    desc: z.string().nullish(),
    locationType: z.string(),
    platformCode: z.string().nullish(),
    cluster: stopDataSchema.nullish(),
    parentStation: z
      .object({
        name: z.string(),
      })
      .nullish(),
  }),
);

const pickupDropoffTypeSchema = z.union([
  z.literal('SCHEDULED'),
  z.literal('NONE'),
  z.literal('CALL_AGENCY'),
  z.literal('COORDINATE_WITH_DRIVER'),
]);

export type PickupDropoffType = z.infer<typeof pickupDropoffTypeSchema>;

const legPlaceDataSchema = z.object({
  name: z.string(),
  vertexType: z.string(),
  lat: z.number(),
  lon: z.number(),
  arrivalTime: z.number(),
  departureTime: z.number(),
  stop: stopDataSchema.nullish(),
});

export type LegPlaceData = z.infer<typeof legPlaceDataSchema>;

const legDataSchema = z.object({
  startTime: z.number(),
  endTime: z.number(),
  departureDelay: z.number(),
  arrivalDelay: z.number(),
  mode: z.string(),
  duration: z.number(),
  legGeometry: z.object({
    length: z.number(),
    points: z.string(),
  }),
  agency: z
    .object({
      id: z.string(),
    })
    .nullish(),
  distance: z.number(),
  transitLeg: z.boolean(),
  from: legPlaceDataSchema,
  to: legPlaceDataSchema,
  trip: z
    .object({
      id: z.string(),
    })
    .nullish(),
  serviceDate: z.string().nullish(),
  headsign: z.string().nullish(),
  pickupType: pickupDropoffTypeSchema,
  dropoffType: pickupDropoffTypeSchema,
  interlineWithPreviousLeg: z.boolean(),
  dropoffBookingInfo: z.unknown(),
  pickupBookingInfo: z.unknown(),
});

export type LegData = z.infer<typeof legDataSchema>;

const itineraryDataSchema = z.object({
  startTime: z.number(),
  endTime: z.number(),
  duration: z.number(),
  waitingTime: z.number(),
  walkTime: z.number(),
  walkDistance: z.number(),
  legs: z.array(legDataSchema),
  accessibilityScore: z.number().nullish(),
  numberOfTransfers: z.number(),
});

export type ItineraryData = z.infer<typeof itineraryDataSchema>;

const journeyDataSchema = z.object({
  messageEnums: z.array(z.string()),
  messageStrings: z.array(z.string()),
  routingErrors: z.array(
    z.object({
      inputField: z.string().nullish(),
    }),
  ),
  itineraries: z.array(itineraryDataSchema),
  debugOutput: z.object({
    totalTime: z.number(),
  }),
});

export type JourneyData = z.infer<typeof journeyDataSchema>;

const clusterToSchema = z.object({
  id: z.number(),
  name: z.string(),
  munros: z.array(z.number()),
  popularityA: z.record(z.number()),
  popularityB: z.record(z.number()),
  point: pointSchema,
});

export type ClusterToSchema = z.infer<typeof clusterToSchema>;

const clusterDataSchema = z.object({
  to: clusterToSchema,
  journeys: z.object({
    out: journeyDataSchema,
    back: journeyDataSchema,
  }),
});

export type ClusterData = z.infer<typeof clusterDataSchema>;

export const reportDataSchema = z.object({
  version: z.literal(0),
  generatedAt: z.string().optional(),
  date: z.string().date(),
  from: pointSchema,
  clusters: z.array(clusterDataSchema),
});

export type ReportData = z.infer<typeof reportDataSchema>;
