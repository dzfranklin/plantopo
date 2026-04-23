import "./loadEnv.js";

import * as trpcExpress from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { auth, userAccessScopes } from "./auth/auth.js";
import { registerAuthRoutes } from "./auth/auth.routes.js";
import { registerClientLogsRoutes } from "./client-logs.routes.js";
import { registerDevNativeAssetsRoutes } from "./dev-native-assets.routes.js";
import { env } from "./env.js";
import { registerExportRoutes } from "./export/export.routes.js";
import { logger } from "./logger.js";
import { requestContextMiddleware } from "./request-context-middleware.js";
import { requestContext } from "./request-context.js";
import { appRouter } from "./router.js";
import { registerStravaRoutes } from "./strava/strava.routes.js";

const app = express();
const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
  // Simulate latency in dev so network behaviour is visible
  app.use((_req, _res, next) => setTimeout(next, Math.random() * 200));
}

app.use("/api/v1", (req, res, next) => {
  if (req.path.startsWith("/auth/")) return next();
  requestContextMiddleware(req, res, next).catch(next);
});

app.get("/_status", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/api/v1/_smoke-test", async (_req, res) => {
  const ctx = requestContext();
  res.json({
    context: {
      reqID: ctx.reqID,
      path: ctx.path,
      user: ctx.user
        ? { id: ctx.user.id, email: ctx.user.email, prefs: ctx.user.prefs }
        : null,
      userAccessScopes: ctx.user ? userAccessScopes(ctx.user) : [],
      client: ctx.client,
    },
  });
});

app.all("/api/v1/auth/*path", toNodeHandler(auth));

registerAuthRoutes(app);
registerStravaRoutes(app);
registerClientLogsRoutes(app);
registerExportRoutes(app);

app.use(
  "/api/v1/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    maxBatchSize: 10,
    createContext: () => requestContext(),
  }),
);

app.all("/api/*path", (_req, res) =>
  res.status(404).json({ error: "Not found" }),
);

async function renderWithSession(
  html: string,
  _req: express.Request,
  res: express.Response,
) {
  const ctx = requestContext();
  const script = `<script>window.__INITIAL_USER__ = JSON.parse(${JSON.stringify(JSON.stringify(ctx.user))});</script>`;
  res
    .setHeader("Content-Type", "text/html")
    .end(html.replace("</head>", `${script}\n</head>`));
}

const httpServer = createServer(app);

if (isDev) {
  const { createDevMiddleware } = await import("@pt/web/util/dev");
  const { middleware, getIndexHtml } = await createDevMiddleware(httpServer);

  registerDevNativeAssetsRoutes(app);

  app.use(middleware);

  app.get("*path", requestContextMiddleware, async (req, res, next) => {
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

  app.get("*path", requestContextMiddleware, async (req, res, next) => {
    try {
      await renderWithSession(indexHTML, req, res);
    } catch (e) {
      next(e);
    }
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err }, "Unhandled error");
    const message =
      err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  },
);

httpServer.listen(4000, () => {
  logger.info(
    { port: 4000, env: isDev ? "dev" : "production" },
    "Server listening",
  );
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
