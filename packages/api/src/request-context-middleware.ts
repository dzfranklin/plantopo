import { fromNodeHeaders } from "better-auth/node";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

import { type User, auth } from "./auth/auth.js";
import { logger } from "./logger.js";
import { type RequestContext, runWithRequestCtx } from "./request-context.js";

export async function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const logBindings: Record<string, unknown> = {};

  const reqId = randomUUID();
  logBindings.reqId = reqId;

  const rawClientInfo = req.get("x-client-info");
  let client: Record<string, string> | undefined = undefined;
  if (rawClientInfo) {
    try {
      logBindings.client = JSON.parse(rawClientInfo, (_, value) =>
        value.toString().slice(0, 100),
      );
      client = logBindings.client as Record<string, string>;
    } catch (err) {
      logger.warn(
        { err, rawClientInfo },
        "Failed to parse x-client-info header",
      );
    }
  }

  let user: User | null = null;
  try {
    const { headers, response } = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      returnHeaders: true,
    });

    user = response?.user ?? null;

    logBindings.sessionId = response?.session.id;
    logBindings.userId = user?.id;

    for (const [key, value] of headers) {
      res.setHeader(key, value);
    }
  } catch (err) {
    logger.error({ err }, "Failed to get session for request");
    res.status(500).json({ error: "Failed to get session" });
    return;
  }

  const ctx: RequestContext = {
    path: req.originalUrl,
    reqId: reqId,
    logger: logger.child(logBindings),
    user,
    clientInfo: client,
  };

  runWithRequestCtx(ctx, next);
}
