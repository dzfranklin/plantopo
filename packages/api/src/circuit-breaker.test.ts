import { beforeEach, describe, expect, it, vi } from "vitest";

import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker.js";

const URL = "https://example.com/";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 }),
    );
  });

  it("should allow requests when closed", async () => {
    const breaker = new CircuitBreaker("test", () => false);
    const response = await breaker.fetch(URL);
    expect(response).toBeInstanceOf(Response);
  });

  it("should trip and block requests when shouldTrip returns true", async () => {
    let trip = false;
    const breaker = new CircuitBreaker("test", () => trip);
    trip = true;

    await breaker.fetch(URL); // First request should trip the breaker
    await expect(breaker.fetch(URL)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("should reset after backoff duration", async () => {
    let trip = false;
    const breaker = new CircuitBreaker("test", () => trip, {
      baseDelayMs: 100,
      maxDelayMs: 100,
    });
    trip = true;

    await breaker.fetch(URL); // First request should trip the breaker
    await expect(breaker.fetch(URL)).rejects.toBeInstanceOf(CircuitOpenError);

    await new Promise(r => setTimeout(r, 150));
    const response = await breaker.fetch(URL);
    expect(response).toBeInstanceOf(Response);
  });

  it("should only allow one probe request when tripped", async () => {
    let trip = false;
    const breaker = new CircuitBreaker("test", () => trip, {
      baseDelayMs: 100,
      maxDelayMs: 100,
    });

    trip = true;
    await breaker.fetch(URL); // First request should trip the breaker
    await expect(breaker.fetch(URL)).rejects.toBeInstanceOf(CircuitOpenError);

    trip = false;
    await new Promise(r => setTimeout(r, 150));

    const probe1 = breaker.fetch(URL);
    const probe2 = breaker.fetch(URL);
    await expect(probe1).resolves.toBeInstanceOf(Response);
    await expect(probe2).rejects.toBeInstanceOf(CircuitOpenError);

    await new Promise(r => setTimeout(r, 50));
    const probe3 = breaker.fetch(URL);
    await expect(probe3).resolves.toBeInstanceOf(Response);
  });
});
