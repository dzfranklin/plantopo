import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import type { Server } from "node:http";

import { appRouter, db } from "@pt/api";
import { setupDb } from "@pt/api/test/setupDb";

let server: Server;

export async function setup() {
  await setupDb();

  const app = express();
  app.use(
    "/api/v1/trpc",
    trpcExpress.createExpressMiddleware({ router: appRouter }),
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Bad address");
  process.env.TEST_API_URL = `http://localhost:${address.port}`;
}

export async function teardown() {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    }),
  );
  await db.$client.end();
}
