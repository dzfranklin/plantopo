import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    silent: "passed-only",
    projects: [
      {
        test: {
          name: "api",
          include: ["src/**/*.test.ts"],
          setupFiles: ["src/test/setup.ts"],
          environment: "node",
          execArgv: ["--import=tsx/esm"],
        },
      },
      {
        test: {
          name: "api-integration",
          include: ["src/**/*.itest.ts"],
          globalSetup: ["src/test/global-setup.integration.ts"],
          setupFiles: ["src/test/setup.integration.ts"],
          environment: "node",
          fileParallelism: false,
        },
      },
    ],
  },
});
