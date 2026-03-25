import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { type APIError, createAuthMiddleware } from "better-auth/api";
import { bearer } from "better-auth/plugins";

import { db } from "../db.js";
import { env } from "../env.js";
import { getLog } from "../logger.js";
import * as schema from "./auth.schema.js";
import { createNativeSessionInitToken } from "./auth.service.js";

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
} else {
  getLog().info("Skipping Google provider");
}

if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  };
} else {
  getLog().info("Skipping GitHub provider");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  plugins: [bearer()],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: `${env.BETTER_AUTH_URL}/api/v1/auth`,
  socialProviders,
  session: {
    expiresIn: 365 * 24 * 60 * 60, // 365 days
    updateAge: 24 * 60 * 60, // 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 15 * 60, // 15 minutes
    },
  },
  trustedOrigins: [
    "http://localhost:4000",
    "http://10.0.2.2:4000",
    "plantopo://oauth",
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith("/callback/")) return;
      const newSession = ctx.context.newSession;
      if (!newSession) return;
      const returned = ctx.context.returned;

      // The redirect is an APIError with a location header (from better-call's ctx.redirect())
      const location: string | null | undefined =
        returned instanceof Response
          ? returned.headers.get("location")
          : (returned as APIError)?.headers?.get?.("location");

      if (location?.startsWith("plantopo://oauth-callback")) {
        const initToken = await createNativeSessionInitToken(
          newSession.session.token,
        );
        const url = new URL(location);
        url.searchParams.set("token", initToken);
        throw ctx.redirect(url.toString());
      }
    }),
  },
});
