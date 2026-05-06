/* eslint-disable @typescript-eslint/no-explicit-any */
import { TRPCError } from "@trpc/server";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/unstable-core-do-not-import";
import { HttpResponse, type RequestHandler, http } from "msw";

import type { AppRouter } from "@pt/api";

import type { User } from "@/auth/auth-client";

interface MockState {
  calls: unknown[][];
  results: Array<{ type: "return" | "throw"; value: unknown }>;
}

type WithMock<T> = T & { mock: MockState };

type TRPCProxy<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? WithMock<
        (
          fn: (
            input: Parameters<T[K]>[0],
            opts: { user: User | null },
          ) => Awaited<ReturnType<T[K]>> | Promise<Awaited<ReturnType<T[K]>>>,
        ) => RequestHandler
      >
    : TRPCProxy<T[K]>;
};

const TRPC_BASE_URL = "http://localhost/api/v1/trpc";

const mocksByPath = new Map<string, MockState>();

function getMock(procedure: string): MockState {
  let mock = mocksByPath.get(procedure);
  if (!mock) {
    mock = { calls: [], results: [] };
    mocksByPath.set(procedure, mock);
  }
  return mock;
}

function makeProxy(path: string[]): unknown {
  const procedure = path.join(".");

  const callable = (
    fn: (input: unknown, opts: { user: User | null }) => unknown,
  ) => {
    return http.post(`${TRPC_BASE_URL}/${procedure}`, async ({ request }) => {
      const input = await request.json();

      const userHeader = request.headers.get("x-test-user");
      let user: User | null = null;
      if (userHeader) {
        try {
          user = JSON.parse(userHeader);
        } catch {
          throw new Error(
            `Invalid JSON in x-test-user header for procedure ${procedure}: ${userHeader}`,
          );
        }
      }

      const mock = getMock(procedure);
      try {
        const data = await fn(input, { user });
        mock.calls.push([input]);
        mock.results.push({ type: "return", value: data });
        return HttpResponse.json({ result: { data } });
      } catch (err) {
        mock.calls.push([input]);
        mock.results.push({ type: "throw", value: err });
        if (err instanceof TRPCError) {
          const code = TRPC_ERROR_CODES_BY_KEY[err.code] ?? -32603;
          return HttpResponse.json({
            error: { message: err.message, code, data: { code: err.code } },
          });
        }
        throw err;
      }
    });
  };
  (callable as any)._isMockFunction = true;

  return new Proxy(callable, {
    get: (target, key) => {
      if (typeof key !== "string") return (target as any)[key];
      if (key === "mock") return getMock(procedure);
      if (key in target) return (target as any)[key];
      return makeProxy([...path, key]);
    },
  });
}

export const trpc = makeProxy([]) as TRPCProxy<AppRouter>;

export function resetTrpcMocks() {
  for (const mock of mocksByPath.values()) {
    mock.calls = [];
    mock.results = [];
  }
}
