import * as trpcExpress from "@trpc/server/adapters/express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import express from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { auth } from "./auth/auth.js";
import { env } from "./env.js";
import { bindLog, logStore, logger } from "./logger.js";
import { appRouter } from "./router.js";

const app = express();
const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
  // Simulate latency in dev so network behaviour is visible
  app.use((_req, _res, next) => setTimeout(next, 50));
}

app.use((_req, _res, next) => {
  logStore.run({ reqId: randomUUID() }, next);
});

app.post("/api/v1/complete-native-login", express.json(), async (req, res) => {
  const token = req.body?.token;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  // Call getSession with asResponse:true so the bearer plugin hook runs
  // and sets the session cookie in the response headers
  const sessionRes = await auth.api
    .getSession({
      headers: new Headers({ authorization: `Bearer ${token}` }),
      asResponse: true,
    })
    .catch(() => null);
  if (!sessionRes || !sessionRes.ok) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const cookieHeader = sessionRes.headers.get("set-cookie");
  if (!cookieHeader) throw new Error("No set-cookie header from auth API");
  res.setHeader("set-cookie", cookieHeader).status(201).end();
});

app.all("/api/v1/auth/*path", toNodeHandler(auth));

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
  logger.info(
    { port: 4000, env: isDev ? "dev" : "production" },
    "Server listening",
  );
});
