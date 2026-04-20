import { fromNodeHeaders } from "better-auth/node";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

import type { ClientInfo } from "@pt/shared";

import { type Session, auth } from "./auth/auth.js";
import { logger } from "./logger.js";
import { type RequestContext, runWithRequestCtx } from "./request-context.js";

export async function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const logBindings: Record<string, unknown> = {};

  const reqID = randomUUID();
  logBindings.reqID = reqID;

  const rawClientInfo = req.get("x-client-info");
  let client: ClientInfo | undefined = undefined;
  if (rawClientInfo) {
    try {
      client = JSON.parse(rawClientInfo);
      logBindings.client = client;
    } catch (err) {
      logger.warn(
        { err, rawClientInfo },
        "Failed to parse x-client-info header",
      );
    }
  }

  let session: Session | null = null;
  try {
    const resp = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      returnHeaders: true,
    });

    session = resp.response;
    logBindings.sessionID = session?.session.id;
    logBindings.userId = session?.user.id;

    for (const [key, value] of resp.headers) {
      res.setHeader(key, value);
    }
  } catch (err) {
    logger.error({ err }, "Failed to get session for request");
    res.status(500).json({ error: "Failed to get session" });
    return;
  }

  const ctx: RequestContext = {
    path: req.originalUrl,
    reqID,
    logger: logger.child(logBindings),
    session,
    client,
  };

  runWithRequestCtx(ctx, next);
}
