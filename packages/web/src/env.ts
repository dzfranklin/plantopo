import { z } from "zod";

const schema = z.object({
  VITE_THUNDERFOREST_TILE_KEY: z.string().min(1),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(
    "[web] Invalid environment variables: " +
      JSON.stringify(z.treeifyError(parsed.error)),
  );
}

export const env = parsed.data;
