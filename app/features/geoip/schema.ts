import { z } from 'zod';

export const geoipSchema = z.object({
  country2: z.string(),
  countrySubdivision: z.string(),
  city: z.string(),
  point: z.tuple([z.number(), z.number()]),
});

export type GeoipData = z.infer<typeof geoipSchema>;
