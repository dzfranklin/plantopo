import * as trpcExpress from "@trpc/server/adapters/express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import express from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { auth } from "./auth/auth.js";
import { env } from "./env.js";
import { appRouter } from "./router.js";

const app = express();
const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
  // Simulate latency in dev so network behaviour is visible
  app.use((_req, _res, next) => setTimeout(next, 50));
}

app.all("/api/v1/auth/*path", toNodeHandler(auth));

app.use(
  "/api/v1/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req }) => ({
      session: await auth.api
        .getSession({ headers: fromNodeHeaders(req.headers) })
        .catch(() => null),
    }),
  }),
);

app.all("/api/*path", (_req, res) => res.status(404).end());

async function injectSession(
  html: string,
  reqHeaders: Record<string, string | string[] | undefined>,
): Promise<string> {
  const session = await auth.api
    .getSession({ headers: fromNodeHeaders(reqHeaders) })
    .catch(() => null);
  const script = `<script>window.__INITIAL_SESSION__ = JSON.parse(${JSON.stringify(JSON.stringify(session))});</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

if (isDev) {
  const { createDevMiddleware } = await import("@pt/web/dev");
  const { middleware, getIndexHtml } = await createDevMiddleware();

  app.use(middleware);

  app.get("*path", async (req, res, next) => {
    try {
      const html = await getIndexHtml(req.originalUrl);
      const injected = await injectSession(html, req.headers);
      res.setHeader("Content-Type", "text/html").end(injected);
    } catch (e) {
      next(e);
    }
  });
} else {
  app.use(express.static(env.WEB_DIST, { index: false }));

  const indexPath = resolve(env.WEB_DIST, "index.html");
  const indexHTML = await readFile(indexPath, "utf-8");

  app.get("*path", async (req, res, next) => {
    try {
      const injected = await injectSession(indexHTML, req.headers);
      res.setHeader("Content-Type", "text/html").end(injected);
    } catch (e) {
      next(e);
    }
  });
}

app.listen(4000, () => {
  console.log(
    `Server running on http://localhost:4000 (${isDev ? "dev" : "production"})`,
  );
});
