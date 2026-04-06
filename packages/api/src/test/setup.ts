import "../loadEnv.js";

import { beforeEach } from "vitest";

import { db } from "../db.js";
import { stravaConnection, stravaOauthState } from "../strava/strava.schema.js";
import { ensureTestUser } from "./setupDb.js";

beforeEach(async () => {
  await db.delete(stravaOauthState);
  await db.delete(stravaConnection);
  await ensureTestUser();
});
