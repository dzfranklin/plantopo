import "./loadEnv.js";

import * as trpcExpress from "@trpc/server/adapters/express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import express from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { auth } from "./auth/auth.js";
import { registerAuthRoutes } from "./auth/auth.routes.js";
import { env } from "./env.js";
import { bindLog, logStore, logger } from "./logger.js";
import { appRouter } from "./router.js";
import { registerStravaRoutes } from "./strava/strava.routes.js";

const app = express();
const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
  // Simulate latency in dev so network behaviour is visible
  app.use((_req, _res, next) => setTimeout(next, 50));
}

app.use((_req, _res, next) => {
  logStore.run({ reqId: randomUUID() }, next);
});

app.get("/_status", (_req, res) => {
  res.status(200).send("OK");
});

app.all("/api/v1/auth/*path", toNodeHandler(auth));

registerAuthRoutes(app);
registerStravaRoutes(app);

app.use(
  "/api/v1/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req }) => {
      const session = await auth.api
        .getSession({ headers: fromNodeHeaders(req.headers) })
        .catch(() => null);
      if (session) {
        bindLog({ userId: session.user.id });
      }
      return { session };
    },
  }),
);

app.all("/api/*path", (_req, res) => res.status(404).end());

async function renderWithSession(
  html: string,
  req: express.Request,
  res: express.Response,
) {
  const session = await auth.api
    .getSession({ headers: fromNodeHeaders(req.headers), returnHeaders: true })
    .catch(() => null);
  if (session?.headers) {
    session.headers.forEach((value, key) => res.setHeader(key, value));
  }
  const script = `<script>window.__INITIAL_SESSION__ = JSON.parse(${JSON.stringify(JSON.stringify(session?.response))});</script>`;
  res
    .setHeader("Content-Type", "text/html")
    .end(html.replace("</head>", `${script}\n</head>`));
}

const httpServer = createServer(app);

if (isDev) {
  const { createDevMiddleware } = await import("@pt/web/dev");
  const { middleware, getIndexHtml } = await createDevMiddleware(httpServer);

  app.use(middleware);

  app.get("*path", async (req, res, next) => {
    try {
      const html = await getIndexHtml(req.originalUrl);
      await renderWithSession(html, req, res);
    } catch (e) {
      next(e);
    }
  });
} else {
  app.use(express.static(env.WEB_DIST, { index: false }));

  const indexPath = path.resolve(env.WEB_DIST, "index.html");
  const indexHTML = await readFile(indexPath, "utf-8");

  app.get("*path", async (req, res, next) => {
    try {
      await renderWithSession(indexHTML, req, res);
    } catch (e) {
      next(e);
    }
  });
}

httpServer.listen(4000, () => {
  logger.info(
    { port: 4000, env: isDev ? "dev" : "production" },
    "Server listening",
  );
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
