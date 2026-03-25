import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";

import { db } from "../db.js";
import { env } from "../env.js";
import * as schema from "./auth.schema.js";

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
} else {
  console.log("Skipping Google provider");
}

if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  };
} else {
  console.log("Skipping GitHub provider");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  plugins: [bearer()],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: `${env.BETTER_AUTH_URL}/api/v1/auth`,
  socialProviders,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 15 * 60, // 15 minutes
    },
  },
});
