import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { GitHubIcon } from "./GitHubIcon.tsx";
import { GoogleIcon } from "./GoogleIcon.tsx";
import { PasskeyIcon } from "./PasskeyIcon.tsx";
import { authClient } from "./auth-client.ts";
import { providersInfo } from "./providers.tsx";
import { logger } from "@/logger.ts";
import { usePageTitle } from "@/usePageTitle.ts";

async function signInWithPasskey(returnToURL: string) {
  const result = await authClient.signIn.passkey({
    extensions: { credProps: true },
  } as Parameters<typeof authClient.signIn.passkey>[0]); // override type def bug
  if (result.error) {
    logger.warn({ err: result.error }, "Passkey sign-in failed");
    toast.error("Sign-in failed. Please try again.");
    return;
  }
  logger.info("Passkey sign-in successful");
  window.location.href = returnToURL;
}

function AuthButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-62.5 items-center justify-center gap-4 rounded-sm border border-gray-200 bg-white px-4 shadow-sm transition-colors hover:bg-gray-50">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  if (window.Native) throw new Error("Auth page loaded in native");

  usePageTitle(mode === "signin" ? "Sign in" : "Sign up");

  const [searchParams] = useSearchParams();
  const returnToURL = searchParams.get("returnTo") ?? "/";

  const verb = mode === "signin" ? "Sign in" : "Sign up";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <h1 className="mb-10 text-2xl font-semibold text-gray-900">PlanTopo</h1>
      <div className="flex w-87.5 flex-col items-center gap-3">
        <AuthButton
          icon={<GoogleIcon />}
          label={`${verb} with ${providersInfo.google.label}`}
          onClick={() =>
            authClient.signIn.social({
              provider: "google",
              callbackURL: returnToURL,
            })
          }
        />
        <AuthButton
          icon={<GitHubIcon />}
          label={`${verb} with ${providersInfo.github.label}`}
          onClick={() =>
            authClient.signIn.social({
              provider: "github",
              callbackURL: returnToURL,
            })
          }
        />
        {mode === "signin" && (
          <AuthButton
            icon={<PasskeyIcon />}
            label="Sign in with a passkey"
            onClick={() => signInWithPasskey(returnToURL)}
          />
        )}
        <p className="mt-2 text-sm text-gray-500">
          {mode === "signin" ? (
            <>
              Don't have an account?{" "}
              <Link to="/signup" className="link">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link to="/login" className="link">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
