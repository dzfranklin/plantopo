import { describe, expect, it, test } from "vitest";

import { sanitizeEnvForLogging } from "./env/helpers.js";

describe("sanitizeEnvForLogging", () => {
  it("redacts db passwords", () => {
    const sanitized = sanitizeEnvForLogging({
      DATABASE_URL: "postgres://user:secret@localhost:5432/db",
      REDIS_URL: "redis://user:secret@localhost:6379",
    });
    expect(sanitized.DATABASE_URL).toBe(
      "postgres://user:<redacted>@localhost:5432/db",
    );
    expect(sanitized.REDIS_URL).toBe("redis://user:<redacted>@localhost:6379");
  });

  it("passes through db URLs without passwords", () => {
    const sanitized = sanitizeEnvForLogging({
      DATABASE_URL: "postgres://localhost:5432/db",
      REDIS_URL: "redis://localhost:6379",
    });
    expect(sanitized.DATABASE_URL).toBe("postgres://localhost:5432/db");
    expect(sanitized.REDIS_URL).toBe("redis://localhost:6379");
  });

  test.for([
    ["SECRET_KEY", "<redacted>"],
    ["ASECRET", "<redacted>"],
    ["SECRET", "<redacted>"],
    ["FOO_KEY", "<redacted>"],
    ["FOO_TOKEN", "<redacted>"],
    ["FOO_PASSWORD", "<redacted>"],
    ["RANDOM", "value"],
  ] as const)("handles %s", ([key, expected]) => {
    const sanitized = sanitizeEnvForLogging({ [key]: "value" });
    expect(sanitized[key]).toBe(expected);
  });
});
