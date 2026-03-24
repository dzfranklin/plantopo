import { describe, expect, it } from "vitest";

import { getCount, setCount } from "./counter.service.js";

describe("counter service", () => {
  it("returns 0 for a fresh counter", async () => {
    expect(await getCount()).toBe(0);
  });

  it("sets and returns the new value", async () => {
    expect(await setCount(42)).toBe(42);
  });

  it("getCount reflects setCount", async () => {
    await setCount(7);
    expect(await getCount()).toBe(7);
  });
});
