import dotenv from "dotenv";
import path from "node:path";

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
  const result = dotenv.config({
    path: path.resolve(parentDir, name),
    quiet: true,
  });
  if (!result.error) loadedEnvSources.push(path.join(parentDirName, name));
}
if (loadedEnvSources.length > 0 && process.env.NODE_ENV !== "test") {
  process.stderr.write(
    "[loadEnv.ts] Loaded " + loadedEnvSources.join(", ") + "\n\n",
  );
}
