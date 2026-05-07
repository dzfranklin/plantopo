import { Counter, Gauge, Histogram } from "prom-client";

import { getLog } from "./logger.js";
import { registry } from "./metrics-registry.js";

export class CircuitOpenError extends Error {
  retryInMs: number;
  constructor(retryInMs: number) {
    super(`Circuit breaker open, retry in ${retryInMs}ms`);
    this.retryInMs = retryInMs;
  }
}

export interface CircuitBreakerOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const requestsTotal = new Counter({
  name: "circuit_breaker_requests_total",
  help: "Total requests through a circuit breaker, by result",
  labelNames: ["circuit", "result"] as const,
  registers: [registry],
});

const stateGauge = new Gauge({
  name: "circuit_breaker_state",
  help: "Circuit breaker state: 0=closed, 1=tripped",
  labelNames: ["circuit"] as const,
  registers: [registry],
});

const backoffDurationHistogram = new Histogram({
  name: "circuit_breaker_backoff_duration_seconds",
  help: "Distribution of backoff durations when the circuit opens",
  labelNames: ["circuit"] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 900, 1800, 3600],
  registers: [registry],
});

const activeBackoffDuration = new Gauge({
  name: "circuit_breaker_active_backoff_duration_seconds",
  help: "Backoff duration of the current open period, 0 when closed",
  labelNames: ["circuit"] as const,
  registers: [registry],
});

const activeBackoffStartTime = new Gauge({
  name: "circuit_breaker_active_backoff_start_time",
  help: "Unix timestamp when the current backoff started, 0 when closed",
  labelNames: ["circuit"] as const,
  registers: [registry],
});

export class CircuitBreaker {
  private name: string;
  private shouldTrip: (response: Response) => boolean;
  private baseDelayMs: number;
  private maxDelayMs: number;

  private isTripped = false;
  private isProbing = false;
  private openedAt = 0;
  private failureCount = 0;

  constructor(
    name: string,
    shouldTrip: (response: Response) => boolean,
    options: CircuitBreakerOptions = {},
  ) {
    this.name = name;
    this.shouldTrip = shouldTrip;
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.maxDelayMs = options.maxDelayMs ?? 600_000;
  }

  private getBackoffDelayMs(): number {
    return Math.min(
      this.baseDelayMs * 2 ** (this.failureCount - 1),
      this.maxDelayMs,
    );
  }

  private checkOpen(): boolean {
    if (!this.isTripped) return false;
    if (Date.now() - this.openedAt >= this.getBackoffDelayMs()) {
      if (this.isProbing) return true;
      this.isProbing = true;
      return false;
    }
    return true;
  }

  private trip(): void {
    this.failureCount++;
    this.isTripped = true;
    this.isProbing = false;
    this.openedAt = Date.now();
    const backoffSecs = this.getBackoffDelayMs() / 1000;
    getLog().warn(
      { failureCount: this.failureCount, retryInSecs: backoffSecs },
      "Circuit breaker opened",
    );
    stateGauge.set({ circuit: this.name }, 1);
    backoffDurationHistogram.observe({ circuit: this.name }, backoffSecs);
    activeBackoffDuration.set({ circuit: this.name }, backoffSecs);
    activeBackoffStartTime.set({ circuit: this.name }, this.openedAt / 1000);
  }

  private reset(): void {
    if (this.failureCount > 0) {
      this.failureCount = 0;
      this.isTripped = false;
      this.isProbing = false;
      stateGauge.set({ circuit: this.name }, 0);
      activeBackoffDuration.set({ circuit: this.name }, 0);
      activeBackoffStartTime.set({ circuit: this.name }, 0);
    }
  }

  async fetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    if (this.checkOpen()) {
      requestsTotal.inc({ circuit: this.name, result: "open" });
      throw new CircuitOpenError(this.getBackoffDelayMs());
    }
    const response = await fetch(input, init);
    if (this.shouldTrip(response)) {
      requestsTotal.inc({ circuit: this.name, result: "closed" });
      this.trip();
    } else {
      requestsTotal.inc({ circuit: this.name, result: "success" });
      this.reset();
    }
    return response;
  }
}
