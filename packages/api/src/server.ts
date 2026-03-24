import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";

import { env } from "./env.js";
import { appRouter } from "./router.js";

const app = express();

app.use(
  "/api/v1/trpc",
  trpcExpress.createExpressMiddleware({ router: appRouter }),
);

app.use(express.static(env.WEB_DIST));

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});
