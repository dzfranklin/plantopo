import { loadEnvFile } from "node:process";
import { defineConfig } from "vitest/config";

loadEnvFile(".test.env");

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
          name: "web",
          include: ["packages/web/src/**/*.test.tsx"],
          globalSetup: ["packages/web/src/test/globalSetup.ts"],
          setupFiles: ["packages/web/src/test/setup.ts"],
          environment: "jsdom",
        },
      },
    ],
  },
});
