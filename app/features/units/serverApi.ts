'use server';

import { apiFetch } from '@/api';
import { UnitSettingsSchema } from './schema';

export const fetchUnitSettings = () =>
  apiFetch({
    path: 'settings/units',
    schema: UnitSettingsSchema.nullable(),
  });
