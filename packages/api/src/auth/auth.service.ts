import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { db } from "../db.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import type { User } from "./auth.js";
import { nativeSessionInitToken, user } from "./auth.schema.js";

if (!env.OWNER_EMAIL) {
  logger.info("No OWNER_EMAIL set, personal tile access will be disabled");
}

export async function createNativeSessionInitToken(
  sessionToken: string,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await db
    .insert(nativeSessionInitToken)
    .values({ token, sessionToken, expiresAt });
  return token;
}

export async function exchangeNativeSessionInitToken(
  initToken: string,
): Promise<string | null> {
  const [row] = await db
    .delete(nativeSessionInitToken)
    .where(eq(nativeSessionInitToken.token, initToken))
    .returning();
  if (!row || row.expiresAt < new Date()) return null;
  return row.sessionToken;
}

function isOwnerEmail(email: string) {
  return env.OWNER_EMAIL && email === env.OWNER_EMAIL;
}

export async function authorizeTileRequest(
  resource: string,
  key: string,
): Promise<boolean> {
  const resources = resource.split(",").map(r => r.trim());
  const needsPersonal = resources.some(r => r.startsWith("personal."));
  const needsEdu = resources.some(r => r.startsWith("edu."));

  if (!needsPersonal && !needsEdu) return true;
  if (!key) return false;

  const [row] = await db
    .select({ email: user.email, eduAccess: user.eduAccess })
    .from(user)
    .where(eq(user.tileKey, key))
    .limit(1);

  if (!row) return false;

  if (needsPersonal && !isOwnerEmail(row.email)) return false;
  if (needsEdu && !row.eduAccess) return false;
  return true;
}

export function userAccessScopes(user: User | undefined | null): string[] {
  if (!user) return [];
  const scopes = ["public"];
  if (isOwnerEmail(user.email)) scopes.push("personal");
  if (user.eduAccess) scopes.push("edu");
  return scopes;
}
