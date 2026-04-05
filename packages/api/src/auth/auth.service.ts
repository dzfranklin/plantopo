import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { db } from "../db.js";
import { nativeSessionInitToken } from "./auth.schema.js";

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

export async function authorizeTileRequest(
  resource: string,
  key: string,
): Promise<boolean> {
  if (resource.startsWith("personal.")) {
    return key === "personal"; // TODO: fixme
  } else if (resource.startsWith("edu.")) {
    return key === "edu"; // TODO: fixme
  } else {
    return true;
  }
}
