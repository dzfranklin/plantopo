'use server';

import { ServerError, apiFetch } from '@/api';
import { z } from 'zod';

const TrackGeoJSONSchema = z.object({
  type: z.literal('Feature'),
  properties: z.object({
    lengthMeters: z.number().optional(),
    durationSecs: z.number().optional(),
    coordinateProperties: z
      .object({
        times: z.array(z.string()).optional(),
        elevationMeters: z.array(z.number()).optional(),
      })
      .optional(),
  }),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
  }),
});

export type TrackGeoJSON = z.infer<typeof TrackGeoJSONSchema>;

const TrackSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  uploadTime: z.string(),
  time: z.string().optional(),
  geojson: TrackGeoJSONSchema,
});

export type Track = z.infer<typeof TrackSchema>;

export const fetchMyTracks = (): Promise<Track[]> =>
  apiFetch({
    path: 'tracks/my',
    params: { orderBy: 'time' },
    schema: z.array(TrackSchema),
  });

export const fetchTrack = (id: string): Promise<Track> =>
  apiFetch({
    path: 'tracks/' + id,
    schema: TrackSchema,
  });

export const deleteTrack = (id: string): Promise<void> =>
  apiFetch({
    path: 'tracks/' + id,
    method: 'DELETE',
    schema: z.object({}),
  })
    .catch((err) => {
      if (err instanceof ServerError && err.status === 404) {
        return;
      }
      throw err;
    })
    .then(() => {});

const TrackImportSchema = z.object({
  id: z.string(),
  ownerID: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  failedAt: z.string().optional(),
  error: z.string().optional(),
  filename: z.string(),
  byteSize: z.number(),
});

export type TrackImport = z.infer<typeof TrackImportSchema>;

export const fetchMyPendingOrRecentTrackImports = (): Promise<TrackImport[]> =>
  apiFetch({
    path: 'tracks/import/my/pending-or-recent',
    schema: z.array(TrackImportSchema),
  });
