import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker.js";

const URL = "https://example.com/";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests when closed", async () => {
    const breaker = new CircuitBreaker("test", () => false);
    expect(breaker.checkOpen()).toBe(false);
    await expect(breaker.fetch(URL)).resolves.toBeInstanceOf(Response);
  });

  it("trips and blocks requests", () => {
    const breaker = new CircuitBreaker("test", () => false, {
      baseDelayMs: 1_000,
    });
    breaker.trip();
    expect(breaker.checkOpen()).toBe(true);
  });

  it("throws CircuitOpenError from fetch when tripped", async () => {
    const breaker = new CircuitBreaker("test", () => true);
    await breaker.fetch(URL); // trips
    await expect(breaker.fetch(URL)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("increases backoff with each trip", () => {
    const breaker = new CircuitBreaker("test", () => false, {
      baseDelayMs: 1_000,
    });
    breaker.trip(); // failureWeight=1 → 1000 * 2^0 = 1000ms
    expect(breaker.getBackoffDelayMs()).toBe(1_000);
    breaker.trip(); // failureWeight=2 → 1000 * 2^1 = 2000ms
    expect(breaker.getBackoffDelayMs()).toBe(2_000);
    breaker.trip(); // failureWeight=3 → 1000 * 2^2 = 4000ms
    expect(breaker.getBackoffDelayMs()).toBe(4_000);
  });

  it("caps backoff at maxDelayMs", () => {
    const breaker = new CircuitBreaker("test", () => false, {
      baseDelayMs: 1_000,
      maxDelayMs: 3_000,
    });
    breaker.trip();
    breaker.trip();
    breaker.trip();
    expect(breaker.getBackoffDelayMs()).toBe(3_000);
  });

  it("decays backoff on recover", () => {
    const breaker = new CircuitBreaker("test", () => false, {
      baseDelayMs: 1_000,
    });
    breaker.trip();
    expect(breaker.getBackoffDelayMs()).toBe(1_000);
    breaker.trip(); // failureWeight=2 → 2000ms
    expect(breaker.getBackoffDelayMs()).toBe(2_000);
    breaker.recover(); // failureWeight=1 → 1000ms
    expect(breaker.getBackoffDelayMs()).toBe(1_000);
  });

  it("allows a probe after backoff expires", async () => {
    const breaker = new CircuitBreaker("test", () => false, {
      baseDelayMs: 100,
      maxDelayMs: 100,
    });
    breaker.trip();
    expect(breaker.checkOpen()).toBe(true);

    await vi.advanceTimersByTimeAsync(150);
    expect(breaker.checkOpen()).toBe(false); // probe allowed
    expect(breaker.checkOpen()).toBe(true); // second concurrent probe blocked
  });

  it("only allows one probe request from fetch when tripped", async () => {
    let trip = false;
    const breaker = new CircuitBreaker("test", () => trip, {
      baseDelayMs: 100,
      maxDelayMs: 100,
    });

    trip = true;
    await breaker.fetch(URL);
    await expect(breaker.fetch(URL)).rejects.toBeInstanceOf(CircuitOpenError);

    trip = false;
    await vi.advanceTimersByTimeAsync(150);

    const probe1 = breaker.fetch(URL);
    const probe2 = breaker.fetch(URL);
    await expect(probe1).resolves.toBeInstanceOf(Response);
    await expect(probe2).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("resets fully on reset()", () => {
    const breaker = new CircuitBreaker("test", () => false, {
      baseDelayMs: 1_000,
    });
    breaker.trip();
    breaker.trip();
    breaker.reset();
    expect(breaker.checkOpen()).toBe(false);
    breaker.trip(); // failureWeight starts from 0 again
    expect(breaker.getBackoffDelayMs()).toBe(1_000);
  });
});
