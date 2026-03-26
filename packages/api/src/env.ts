import { z } from "zod";

const schema = z.object({
  // LOG_LEVEL is read directly in logger.ts
  APP_URL: z.url(),
  DATABASE_URL: z.url(),
  WEB_DIST: z.string().default("packages/web/dist"),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Invalid environment variables:" +
      JSON.stringify(z.treeifyError(parsed.error)),
  );
  process.exit(1);
}

export const env = parsed.data;
