import { z } from 'zod';

const GeoipCookieSchema = z.object({
  country2: z.string(),
  countrySubdivision2: z.string(),
  city: z.string(),
  point: z.tuple([z.number(), z.number()]),
});

export type GeoipCookie = z.infer<typeof GeoipCookieSchema>;
