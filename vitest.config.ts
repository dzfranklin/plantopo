import { loadEnvFile } from "node:process";
import { defineConfig } from "vitest/config";

loadEnvFile(".test.env");

export default defineConfig({
  test: {
    globalSetup: ["packages/api/src/test/globalSetup.ts"],
    setupFiles: ["packages/api/src/test/setup.ts"],
  },
});
