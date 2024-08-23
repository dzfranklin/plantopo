import { apiFetch } from '@/api_to_remove/clientFetch';
import { z } from 'zod';

const TrackImportSchema = z.object({
  id: z.string(),
  filename: z.string(),
});

export type TrackImport = z.infer<typeof TrackImportSchema>;

export const uploadTracks = async (files: File[]): Promise<TrackImport[]> => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const resp = await apiFetch({
    path: 'tracks/import',
    body: formData,
    schema: z.object({
      imports: z.array(TrackImportSchema),
    }),
  });
  return resp.imports;
};

export const pollImportStatusChange = (): Promise<void> =>
  apiFetch({
    path: 'tracks/import/poll',
    schema: z.object({}),
  }).then(() => {});
