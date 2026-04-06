import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../db.js";
import { TEST_USER } from "../test/setupDb.js";
import { user } from "./auth.schema.js";
import { authorizeTileRequest } from "./auth.service.js";

describe("authorizeTileRequest", () => {
  it("allows public resources without a key", async () => {
    expect(await authorizeTileRequest("os_leisure", "")).toBe(true);
  });

  it("allows public resources with any key", async () => {
    expect(await authorizeTileRequest("os_leisure", "garbage")).toBe(true);
  });

  it("allows comma-separated list of public resources", async () => {
    expect(await authorizeTileRequest("os_leisure,satellite", "")).toBe(true);
  });

  it("rejects personal resource with no key", async () => {
    expect(await authorizeTileRequest("personal.foo", "")).toBe(false);
  });

  it("rejects personal resource with unknown key", async () => {
    expect(await authorizeTileRequest("personal.foo", "unknown")).toBe(false);
  });

  it("rejects personal resource when user is not the owner", async () => {
    // TEST_USER email does not match OWNER_EMAIL (unset or different in test env)
    expect(await authorizeTileRequest("personal.foo", TEST_USER.tileKey)).toBe(
      false,
    );
  });

  it("rejects edu resource when user lacks edu_access", async () => {
    expect(await authorizeTileRequest("edu.foo", TEST_USER.tileKey)).toBe(
      false,
    );
  });

  it("allows edu resource when user has edu_access", async () => {
    await db
      .update(user)
      .set({ eduAccess: true })
      .where(eq(user.id, TEST_USER.id));
    expect(await authorizeTileRequest("edu.foo", TEST_USER.tileKey)).toBe(true);
  });

  it("rejects mixed list when user lacks edu_access", async () => {
    expect(
      await authorizeTileRequest("os_leisure,edu.foo", TEST_USER.tileKey),
    ).toBe(false);
  });
});
