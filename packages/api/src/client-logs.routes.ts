import { fromNodeHeaders } from "better-auth/node";
import express, { type Router } from "express";

import { ClientLogsPostBodySchema } from "@pt/shared";

import { auth } from "./auth/auth.js";
import { getLog } from "./logger.js";

export function registerClientLogsRoutes(app: Router) {
  app.post("/api/v1/client-logs", express.json(), async (req, res) => {
    const log = getLog();

    const session = await auth.api
      .getSession({ headers: fromNodeHeaders(req.headers) })
      .catch(() => null);

    const data = ClientLogsPostBodySchema.safeParse(req.body);
    if (!data.success) {
      log.warn(
        { error: data.error, requestBody: JSON.stringify(req.body) },
        "Invalid client logs",
      );
      res.status(400).end();
      return;
    }

    const entries = data.data.entries.map(entry => ({
      ...entry,
      userId: session?.user.id,
      sessionId: session?.session?.id,
    }));

    for (const entry of entries) {
      log[entry.level](
        {
          ...entry,
          time: new Date(entry.ts).toISOString(), // overrides the timestamp of this call
          message: entry.msg, // msg is overridden by the second argument of this call
        },
        "Client log",
      );
    }

    res.status(204).end();
  });
}
