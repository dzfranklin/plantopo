import { fromNodeHeaders } from "better-auth/node";
import type { Router } from "express";

import { auth } from "../auth/auth.js";
import { env } from "../env.js";
import { getLog } from "../logger.js";
import {
  STRAVA_AUTH_URL,
  STRAVA_SCOPE,
  createStravaState,
  exchangeCodeForTokens,
  upsertStravaConnection,
  verifyStravaState,
} from "./strava.service.js";

export function registerStravaRoutes(app: Router) {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
    getLog().info("Skipping Strava routes (no credentials configured)");
    return;
  }

  // Redirect the authenticated user to Strava's OAuth authorization page.
  app.get("/api/v1/strava/connect", async (req, res) => {
    const session = await auth.api
      .getSession({ headers: fromNodeHeaders(req.headers) })
      .catch(() => null);
    if (!session) {
      res.status(401).send("Unauthorized");
      return;
    }

    const state = await createStravaState(session.user.id);
    const callbackUrl = `${env.APP_URL}/api/v1/strava/callback`;

    const url = new URL(STRAVA_AUTH_URL);
    url.searchParams.set("client_id", env.STRAVA_CLIENT_ID!);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("scope", STRAVA_SCOPE);
    url.searchParams.set("state", state);

    res.redirect(url.toString());
  });

  // Strava redirects back here after the user authorizes (or denies).
  app.get("/api/v1/strava/callback", async (req, res) => {
    const log = getLog();
    const {
      code,
      state,
      error: stravaError,
    } = req.query as Record<string, string | undefined>;

    if (stravaError) {
      log.info({ stravaError }, "Strava OAuth denied by user");
      res.redirect("/settings/account?strava=denied");
      return;
    }

    if (!state || !code) {
      res.status(400).send("Bad request");
      return;
    }

    const verified = await verifyStravaState(state);
    if (!verified) {
      res.status(400).send("Invalid or expired state");
      return;
    }

    let tokenData;
    try {
      tokenData = await exchangeCodeForTokens(code);
    } catch (err) {
      log.error({ err }, "Strava token exchange failed");
      res.redirect("/settings/account?strava=error");
      return;
    }

    await upsertStravaConnection(verified.userId, tokenData);

    log.info(
      { userId: verified.userId, athleteId: tokenData.athlete.id },
      "Strava account linked",
    );
    res.redirect("/settings/account?strava=connected");
  });
}
