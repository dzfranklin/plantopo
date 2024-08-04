import { z } from 'zod';

export const UnitSystemSchema = z.union([
  z.literal('metric'),
  z.literal('customary'),
]);

export type UnitSystem = z.infer<typeof UnitSystemSchema>;

export const UnitSettingsSchema = z.object({
  distance: UnitSystemSchema,
  elevation: UnitSystemSchema,
});

export type UnitSettings = z.infer<typeof UnitSettingsSchema>;
