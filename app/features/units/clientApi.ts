import { apiFetch } from '@/api/clientFetch';
import { UnitSettings } from './schema';
import { z } from 'zod';

export const setUnitSettings = (settings: UnitSettings) =>
  apiFetch({
    path: 'settings/units',
    schema: z.unknown(),
    body: settings,
  }).then(() => {});
