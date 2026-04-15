import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    silent: "passed-only",
    projects: [
      {
        test: {
          name: "api",
          include: ["packages/api/src/**/*.test.ts"],
          globalSetup: ["packages/api/src/test/globalSetup.ts"],
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
          globalSetup: ["packages/web/src/test/globalSetup.ts"],
          setupFiles: ["packages/web/src/test/setup.ts"],
          environment: "jsdom",
        },
      },
    ],
  },
});
