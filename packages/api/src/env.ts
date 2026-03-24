import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  WEB_DIST: z.string().default("packages/web/dist"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
