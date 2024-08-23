import { apiFetch } from '@/api_to_remove/clientFetch';
import { UnitSettings } from './schema';
import { z } from 'zod';

export const setUnitSettings = (settings: UnitSettings) =>
  apiFetch({
    path: 'settings/units',
    schema: z.unknown(),
    body: settings,
  }).then(() => {});
