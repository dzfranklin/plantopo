import { spawnSync } from "node:child_process";
import path from "node:path";

const src = path.resolve(import.meta.dirname, "../packages/api/src");

const envBefore = { ...process.env };

// Load env the same way the API does
await import(path.resolve(src, "loadEnv.js"));

const [, , ...args] = process.argv;

if (args.length === 0) {
  for (const [key, value] of Object.entries(process.env)) {
    if (envBefore[key] !== value) {
      process.stdout.write(`${key}=${value}\n`);
    }
  }
} else {
  const result = spawnSync(args[0], args.slice(1), { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
