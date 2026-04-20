import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { type APIError, createAuthMiddleware } from "better-auth/api";
import { bearer } from "better-auth/plugins";

import { db } from "../db.js";
import { env } from "../env.js";
import { getLog, logger } from "../logger.js";
import * as schema from "./auth.schema.js";
import { createNativeSessionInitToken, isOwnerEmail } from "./auth.service.js";

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];

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

const authLogger = logger.child({ module: "auth" });

const trustedOrigins = [
  env.APP_URL,
  "plantopo://oauth-callback",
  "plantopo-debug://oauth-callback", // Allow signing in to debug builds with prod credentials
];

if (process.env.NODE_ENV !== "production") {
  trustedOrigins.push(
    "http://localhost:3030",
    "http://localhost:4000",
    "http://10.0.2.2:4000",
    "http://prin:4000",
    "plantopo-debug://oauth-callback",
  );
}

let configuredPasskey = passkey({
  rpName: "PlanTopo",
  rpID: "plantopo.com",
  origin: env.APP_URL,
});
if (process.env.NODE_ENV !== "production") {
  configuredPasskey = passkey({
    rpName: "PlanTopo (dev)",
    rpID: "localhost",
    origin: trustedOrigins,
  });
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  plugins: [bearer(), configuredPasskey],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: `${env.APP_URL}/api/v1/auth`,
  socialProviders,
  errorURL: `${env.APP_URL}/auth-error`,
  user: {
    additionalFields: {
      prefs: {
        type: "json",
        required: true,
        defaultValue: {},
      },
      tileKey: {
        type: "string",
        required: true,
        input: false,
      },
      eduAccess: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 365 * 24 * 60 * 60, // 365 days
    updateAge: 24 * 60 * 60, // 24 hours
    // cookieCache: {
    //   enabled: true,
    //   maxAge: 15 * 60, // 15 minutes
    // },
  },
  trustedOrigins,
  logger: {
    disableColors: true,
    level: "info",
    log: (level, message, ...args) => {
      if (level === "error") {
        const err = new Error(message);
        authLogger.error({ err, args }, message);
      } else {
        authLogger[level]({ args }, message);
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async user => {
          authLogger.info(
            { userId: user.id, email: user.email },
            "user signed up",
          );
        },
      },
      delete: {
        after: async user => {
          authLogger.info(
            { userId: user.id, email: user.email },
            "user deleted",
          );
        },
      },
    },
    account: {
      create: {
        after: async account => {
          authLogger.info(
            {
              id: account.id,
              userId: account.userId,
              provider: account.providerId,
            },
            "account linked",
          );
        },
      },
      delete: {
        after: async account => {
          authLogger.info(
            {
              id: account.id,
              userId: account.userId,
              provider: account.providerId,
            },
            "account unlinked",
          );
        },
      },
    },
    session: {
      create: {
        after: async session => {
          authLogger.info(
            {
              userId: session.userId,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
              sessionId: session.id,
            },
            "session created",
          );
        },
      },
      delete: {
        after: async session => {
          authLogger.info(
            {
              userId: session.userId,
              sessionId: session.id,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
            },
            "session deleted",
          );
        },
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async ctx => {
      if (!ctx.path.startsWith("/callback/")) return;
      const newSession = ctx.context.newSession;
      if (!newSession) return;
      const returned = ctx.context.returned;

      // The redirect is an APIError with a location header (from better-call's ctx.redirect())
      const location: string | null | undefined =
        returned instanceof Response
          ? returned.headers.get("location")
          : ((returned as APIError)?.headers as Headers | undefined)?.get?.(
              "location",
            );

      if (
        location?.startsWith("plantopo://oauth-callback") ||
        location?.startsWith("plantopo-debug://oauth-callback")
      ) {
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
export function userAccessScopes(user: User | undefined | null): string[] {
  if (!user) return [];
  const scopes = ["public"];
  if (isOwnerEmail(user.email)) scopes.push("personal");
  if (user.eduAccess) scopes.push("edu");
  return scopes;
}
