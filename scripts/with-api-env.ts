import { spawnSync } from "node:child_process";

import { parseEnvFiles } from "../packages/api/src/env/helpers";

const [, , ...args] = process.argv;

const result = parseEnvFiles(process.env);
process.stderr.write(
  `> with-api-env.ts Loaded ${result.envName} env from files: ${result.loadedFiles.join(", ")}\n\n`,
);

if (args.length === 0) {
  process.stdout.write(
    Object.entries(result.env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  );
} else {
  const result = spawnSync(args[0], args.slice(1), { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
