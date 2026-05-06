import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw-server";
import { resetTrpcMocks } from "./trpc";

beforeAll(async () => {
  await server.start({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url);
      // Allow Vite dev server asset fetches (but not /api routes)
      if (url.hostname === "localhost" && !url.pathname.startsWith("/api")) {
        return;
      }
      print.error();
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  resetTrpcMocks();
});

afterAll(() => server.stop());
