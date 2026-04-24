import { build } from "esbuild";

const nodeVersion = "24";

// Build @pt/shared so it's available as a real package at runtime
await build({
  bundle: true,
  platform: "node",
  target: `node${nodeVersion}`,
  format: "esm",
  entryPoints: ["packages/shared/src/index.ts"],
  outfile: "packages/shared/dist/index.js",
  tsconfig: "packages/shared/tsconfig.json",
});

// --packages=external leaves all node_modules as runtime require() calls.
const shared = {
  bundle: true,
  platform: "node",
  target: `node${nodeVersion}`,
  format: "esm",
  packages: "external",
  sourcemap: true,
  tsconfig: "packages/api/tsconfig.json",
};

await build({
  ...shared,
  entryPoints: ["packages/api/src/server.ts"],
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "server.js",
});

await build({
  ...shared,
  entryPoints: ["packages/api/src/migrate.ts"],
  outfile: "migrate.js",
});

await build({
  ...shared,
  entryPoints: ["packages/api/src/run-task.ts"],
  outfile: "run-task.js",
});
