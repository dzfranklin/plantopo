import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { db } from "../db.js";
import { getLog } from "../logger.js";
import {
  STRAVA_AUTH_URL,
  STRAVA_SCOPE,
  type StravaAthlete,
  StravaAthleteSchema,
  exchangeCodeForTokens,
  revokeToken,
} from "./strava.api.js";
import { stravaConnection, stravaOauthState } from "./strava.schema.js";

export { STRAVA_AUTH_URL, STRAVA_SCOPE, type StravaAthlete };

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function createStravaState(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(stravaOauthState).values({
    token,
    userId,
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });
  return token;
}

export async function verifyStravaState(
  token: string,
): Promise<{ userId: string } | null> {
  const [row] = await db
    .delete(stravaOauthState)
    .where(
      and(
        eq(stravaOauthState.token, token),
        gt(stravaOauthState.expiresAt, new Date()),
      ),
    )
    .returning({ userId: stravaOauthState.userId });
  return row ?? null;
}

export async function upsertStravaConnection(
  userId: string,
  tokenData: Awaited<ReturnType<typeof exchangeCodeForTokens>>,
) {
  const { athlete, access_token, refresh_token, expires_at } = tokenData;
  getLog().info(
    { userId, athleteId: athlete.id },
    "Upserting Strava connection",
  );
  await db
    .insert(stravaConnection)
    .values({
      userId,
      athleteId: String(athlete.id),
      accessToken: access_token,
      refreshToken: refresh_token,
      accessTokenExpiresAt: new Date(expires_at * 1000),
      scope: STRAVA_SCOPE,
      athlete,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: stravaConnection.userId,
      set: {
        athleteId: String(athlete.id),
        accessToken: access_token,
        refreshToken: refresh_token,
        accessTokenExpiresAt: new Date(expires_at * 1000),
        scope: STRAVA_SCOPE,
        athlete,
        updatedAt: new Date(),
      },
    });
}

export async function getStravaAccount(
  userId: string,
): Promise<{ athlete: StravaAthlete } | null> {
  const [row] = await db
    .select({ athlete: stravaConnection.athlete })
    .from(stravaConnection)
    .where(eq(stravaConnection.userId, userId))
    .limit(1);
  if (!row) return null;

  const athlete = StravaAthleteSchema.parse(row.athlete);

  if (athlete.profile === "avatar/athlete/large.png") {
    athlete.profile =
      "https://d3nn82uaxijpm6.cloudfront.net/assets/avatar/athlete/large-59a8e8528934934c80cc56ea197a256eb5dc71bc6e6451ba5769cdd968c7e232.png";
  }

  return { athlete };
}

export async function deleteStravaConnection(userId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(stravaConnection)
    .where(eq(stravaConnection.userId, userId))
    .returning({ accessToken: stravaConnection.accessToken });
  if (!deleted) return false;

  getLog().info({ userId }, "Strava connection deleted, revoking token");
  // Best-effort — revoke the token on Strava's side, don't block on failure.
  revokeToken(deleted.accessToken)
    .then(() => getLog().info({ userId }, "Strava token revoked"))
    .catch(err => getLog().error({ err }, "Strava token revocation failed"));

  return true;
}

export { exchangeCodeForTokens };
