import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import type { Server } from "node:http";

import { appRouter, db, logStore, setupDb } from "@pt/api/webTestSupport";

let server: Server;

export async function setup() {
  await setupDb();

  const app = express();
  app.use((_req, _res, next) => {
    logStore.run({ reqId: "1" }, next);
  });
  app.use(
    "/api/v1/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: ({ req }) => {
        const header = req.headers["x-test-session"];
        const session = typeof header === "string" ? JSON.parse(header) : null;
        return { session };
      },
    }),
  );

  await new Promise<void>(resolve => {
    server = app.listen(0, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Bad address");
  process.env.TEST_API_URL = `http://localhost:${address.port}`;
}

export async function teardown() {
  await new Promise<void>((resolve, reject) =>
    server.close(err => {
      if (err) reject(err);
      else resolve();
    }),
  );
  await db.$client.end();
}
