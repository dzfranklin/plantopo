import { build } from "esbuild";

const nodeVersion = "24";

// --packages=external leaves all node_modules as runtime require() calls.
// @pt/shared is resolved via tsconfig paths to source, so esbuild bundles it inline.
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
