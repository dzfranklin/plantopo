import { serializeSignedCookie } from "better-call";
import type { Router } from "express";

import { getLog } from "../logger.js";
import { auth } from "./auth.js";
import {
  authorizeTileRequest,
  exchangeNativeSessionInitToken,
} from "./auth.service.js";

export function registerAuthRoutes(app: Router) {
  // Flow: The native app opens /login in a custom tab, the user logs in via
  // OAuth, then we redirect to a custom URL scheme with a short-lived one-time
  // initiation token in the query (see auth.ts). The native app calls this
  // endpoint to exchange that token for a session cookie and API token, then sets
  // that cookie in its webview's cookie jar.
  //
  // Request: POST /api/v1/native-session Authorization: Bearer <initToken>
  // Response: 200 OK Set-Cookie: sessionToken=... {"token": "api-token"}
  app.post("/api/v1/native-session", async (req, res) => {
    const authHeader = req.headers.authorization;
    const initToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!initToken) {
      res.status(400).send("Error: Missing token");
      return;
    }

    const token = await exchangeNativeSessionInitToken(initToken);
    if (!token) {
      res.status(401).send("Error: Invalid or expired token");
      return;
    }

    const session = await auth.api
      .getSession({
        headers: new Headers({ authorization: `Bearer ${token}` }),
      })
      .catch(() => null);
    if (!session) {
      res.status(401).send("Error: Invalid session");
      return;
    }

    const ctx = await auth.$context;
    const cookieName = ctx.authCookies.sessionToken.name;
    const cookieAttrs = ctx.authCookies.sessionToken.attributes;
    const maxAge = ctx.sessionConfig.expiresIn;
    const signedCookie = await serializeSignedCookie(
      cookieName,
      token,
      ctx.secret,
      {
        ...cookieAttrs,
        maxAge,
      },
    );

    res
      .setHeader("set-cookie", signedCookie)
      .setHeader("content-type", "application/json")
      .status(200)
      .send(JSON.stringify({ token }));
  });

  // Used by nginx tile proxy. Responses are cached by resource and key.
  app.get("/api/v1/authorize-tile-request", async (req, res) => {
    const resource = req.query.resource;
    const key = req.query.key;
    if (typeof resource !== "string" || typeof key !== "string") {
      res.status(400).send("Bad request");
      return;
    }
    const logger = getLog().child({ resource, key });

    const result = await authorizeTileRequest(resource, key);
    logger.info({ authorized: result }, "Checked tile request authorization");

    if (result) {
      res.status(200).send("OK");
    } else {
      res.status(403).send("Forbidden");
    }
  });
}
