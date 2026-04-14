import z from "zod";

import { PointSchema } from "@pt/shared";

import { publicProcedure, router } from "../trpc.js";
import {
  GeocodeOptionsSchema,
  ReverseGeocodeOptionsSchema,
  geocode,
  reverseGeocode,
} from "./geocoder.service.js";

export const geocoderRouter = router({
  geocode: publicProcedure
    .input(GeocodeOptionsSchema.extend({ query: z.string() }))
    .query(async ({ input, signal }) => {
      const { query, ...options } = input;
      return await geocode(query, options, { signal });
    }),
  reverseGeocode: publicProcedure
    .input(ReverseGeocodeOptionsSchema.extend({ point: PointSchema }))
    .query(async ({ input, signal }) => {
      const { point, ...options } = input;
      return await reverseGeocode(point, options, { signal });
    }),
});
