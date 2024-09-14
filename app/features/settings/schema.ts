import { components } from '@/api/v1';

export type Settings = components['schemas']['Settings'];

export type UnitSystem = Settings['units'];
