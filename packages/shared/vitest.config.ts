import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    silent: "passed-only",
    name: "shared",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
