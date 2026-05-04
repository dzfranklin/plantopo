import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    silent: "passed-only",
    projects: [
      {
        test: {
          name: "api",
          include: ["packages/api/src/**/*.test.ts"],
          setupFiles: ["packages/api/src/test/setup.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "shared",
          include: ["packages/shared/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: "./packages/web/vite.config.js",
        test: {
          name: "web",
          include: ["packages/web/src/**/*.test.{ts,tsx}"],
          setupFiles: ["packages/web/src/test/setup.ts"],
          environment: "jsdom",
          execArgv: [
            "--localstorage-file",
            path.resolve(os.tmpdir(), `vitest-${process.pid}.localstorage`),
          ],
        },
      },
      {
        test: {
          name: "api-integration",
          include: ["packages/api/src/**/*.itest.ts"],
          globalSetup: ["packages/api/src/test/globalSetup.ts"],
          setupFiles: ["packages/api/src/test/setup.integration.ts"],
          environment: "node",
          fileParallelism: false,
        },
      },
    ],
  },
});
