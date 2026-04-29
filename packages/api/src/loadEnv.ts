import { readFileSync } from "node:fs";
import path from "node:path";

const LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

const envSources = process.env.NODE_ENV
  ? [
      `.env.${process.env.NODE_ENV}.local`,
      `.env.${process.env.NODE_ENV}`,
      ".env.local",
      ".env",
    ]
  : [".env.local", ".env"];
const loadedEnvSources = [];
const parentDir = path.resolve(import.meta.dirname, "..");
const parentDirName = path.basename(parentDir);
for (const name of envSources) {
  const result = configDotenv({
    path: path.resolve(parentDir, name),
  });
  if (!result.error) loadedEnvSources.push(path.join(parentDirName, name));
}
if (loadedEnvSources.length > 0 && process.env.NODE_ENV !== "test") {
  process.stderr.write(
    "[loadEnv.ts] Loaded " + loadedEnvSources.join(", ") + "\n\n",
  );
}

// Based on <https://github.com/motdotla/dotenv/blob/10f5c0fb341089a16defab128a0cfe9e548c49ec/lib/main.js>

function configDotenv(options: { path?: string | string[] }) {
  let optionPaths: string[] = [];
  if (typeof options.path === "string") {
    optionPaths = [options.path];
  } else if (Array.isArray(options.path)) {
    optionPaths = options.path;
  } else {
    optionPaths = [path.resolve(process.cwd(), ".env")];
  }

  // Build the parsed data in a temporary object (because we need to return it).  Once we have the final
  // parsed data, we will combine it with process.env (or options.processEnv if provided).
  let lastError;
  const parsedAll = {};
  for (const path of optionPaths) {
    try {
      // Specifying an encoding returns a string instead of a buffer
      const parsed = parse(readFileSync(path, { encoding: "utf8" }));

      populate(parsedAll, parsed);
    } catch (e) {
      lastError = e;
    }
  }

  populate(process.env, parsedAll);

  if (lastError) {
    return { parsed: parsedAll, error: lastError };
  } else {
    return { parsed: parsedAll };
  }
}

// Parse src into an Object
function parse(lines: string) {
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

// Populate process.env with parsed values
function populate(
  processEnv: { [key: string]: string | undefined },
  parsed: { [key: string]: string },
): { [key: string]: string } {
  const populated: { [key: string]: string } = {};

  if (typeof parsed !== "object") {
    throw new Error(
      "OBJECT_REQUIRED: Please check the processEnv argument being passed to populate",
    );
  }

  // Set process.env
  for (const key of Object.keys(parsed)) {
    processEnv[key] = parsed[key]!;
    populated[key] = parsed[key]!;
  }

  return populated;
}
