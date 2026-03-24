import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";

import { appRouter } from "./router.js";

const app = express();

// Simulate latency
app.use((_req, _res, next) => setTimeout(next, 50));

app.use(
  "/api/v1/trpc",
  trpcExpress.createExpressMiddleware({ router: appRouter }),
);

const { createDevMiddleware } = await import("@pt/web/dev");
app.use(await createDevMiddleware());

app.listen(4000, () => {
  console.log("Server (dev mode) running on http://localhost:4000");
});
