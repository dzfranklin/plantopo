import { readFileSync } from "node:fs";
import path from "node:path";
import z from "zod";

import { by } from "@pt/shared";

export const EnvSchema = z.object({
  // LOG_LEVEL is read directly in logger.ts
  PORT: z.coerce.number().default(4000),
  METRICS_PORT: z.coerce.number().default(4001),
  APP_URL: z.url(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  WEB_DIST: z.string().default("packages/web/dist"),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  OWNER_EMAIL: z.email().optional(),
  TILE_CACHE_DIR: z.string(),
  SERVER_TILE_KEY: z.string().optional(),
  VALHALLA: z.string().optional(),
  PHOTON: z.string().optional(),
  THUNDERFOREST_KEY: z.string().optional(),
  S3_ENDPOINT: z.url(),
  S3_IMAGE_BUCKET: z.string(),
  S3_IMAGE_ACCESS_KEY_ID: z.string(),
  S3_IMAGE_SECRET_ACCESS_KEY: z.string(),
  IMGPROXY_BASE_URL: z.url().default("https://imgproxy.plantopo.com"),
  IMGPROXY_KEY: z.string(),
  IMGPROXY_SALT: z.string(),
});

interface EnvResult {
  envName: string;
  env: Record<string, string>;
  sources: Record<string, string>;
  loadedFiles: string[];
}

export function loadEnvFilesAtStartup() {
  const result = parseEnvFiles(process.env);
  if (result.loadedFiles.length > 0 && result.envName !== "test") {
    printLoadEnvFilesAtStartupResult(result);
  }
}

function printLoadEnvFilesAtStartupResult(result: EnvResult) {
  const relevantKeys = new Set([
    ...EnvSchema.keyof().options,
    ...Object.keys(result.env),
  ]);

  const msg = [
    `(${result.envName}) Loaded env from files: ${result.loadedFiles.join(", ")} (${Object.keys(result.env).length} keys)`,
  ];

  if (result.envName === "development") {
    msg.push(
      ...Object.entries(process.env)
        .sort(by(([k]) => k))
        .filter(([k]) => relevantKeys.has(k))
        .map(([k, v]) => `  ${k}=${v} (${result.sources[k] || "process.env"})`),
    );
  }

  process.stderr.write("\n" + msg.join("\n") + "\n\n");
}

export function parseProcessEnvAtStartup() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    const msg =
      "Invalid environment variables: " +
      [
        ...formErrors,
        ...Object.entries(fieldErrors)
          .sort(by(([k]) => k))
          .map(([k, err]) => `${k}: ${err}`),
      ].join("; ");
    process.stderr.write("\n" + msg + "\n\n");
    process.exit(1);
  }
  return parsed.data;
}

/** Loads env files (based on NODE_ENV) into `target`. Does not override existing keys */
export function parseEnvFiles(target: typeof process.env): EnvResult {
  const envName = process.env.NODE_ENV || "production";
  const sourceCandidates = [
    `.env.${envName}.local`,
    `.env.${envName}`,
    ".env.local",
    ".env",
  ];

  const preexistingKeys = new Set(Object.keys(target));
  const env: Record<string, string> = {};
  const loadedFiles: string[] = [];
  const sources: Record<string, string> = {};
  for (const file of sourceCandidates) {
    const parsed = parseFile(
      path.resolve(import.meta.dirname, "..", "..", file),
    );
    if (parsed) {
      for (const [k, v] of Object.entries(parsed)) {
        if (!preexistingKeys.has(k)) {
          env[k] = v;
          sources[k] = file;
        }
      }
      loadedFiles.push(file);
    }
  }

  Object.assign(target, env);

  return { env, loadedFiles, sources, envName };
}

function parseFile(path: string): Record<string, string> | null {
  try {
    const content = readFileSync(path, "utf-8");
    return parseFileContents(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    process.stderr.write(`Error loading ${path}: ${(err as Error).message}\n`);
    console.error(err);
    process.exit(1);
  }
}

// Parse src into an Object
function parseFileContents(lines: string) {
  // Adapted from <https://github.com/motdotla/dotenv/blob/10f5c0fb341089a16defab128a0cfe9e548c49ec/lib/main.js>

  const LINE =
    /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

  const obj: { [key: string]: string } = {};

  // Convert line breaks to same format
  lines = lines.replace(/\r\n?/gm, "\n");

  let match;
  while ((match = LINE.exec(lines)) != null) {
    const key = match[1]!;

    // Default undefined or null to empty string
    let value = match[2] || "";

    // Remove whitespace
    value = value.trim();

    // Check if double quoted
    const maybeQuote = value[0];

    // Remove surrounding quotes
    value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");

    // Expand newlines if double quoted
    if (maybeQuote === '"') {
      value = value.replace(/\\n/g, "\n");
      value = value.replace(/\\r/g, "\r");
    }

    // Add to object
    obj[key] = value;
  }

  return obj;
}

export function sanitizeEnvForLogging(
  input: Record<string, string | number | undefined>,
) {
  const sanitized: Record<string, string | number | undefined> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "DATABASE_URL" || key === "REDIS_URL") {
      sanitized[key] = (value as string).replace(/[^@:]+(?=@)/, "<redacted>");
    } else if (key.match(/SECRET|KEY|TOKEN|PASS/)) {
      sanitized[key] = "<redacted>";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
