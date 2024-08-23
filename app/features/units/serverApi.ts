'use server';

import { apiFetch } from '@/api_to_remove';
import { UnitSettingsSchema } from './schema';

export const fetchUnitSettings = () =>
  apiFetch({
    path: 'settings/units',
    schema: UnitSettingsSchema.nullable(),
  });
