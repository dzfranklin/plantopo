import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { GitHubIcon } from "./GitHubIcon.tsx";
import { GoogleIcon } from "./GoogleIcon.tsx";
import { PasskeyIcon } from "./PasskeyIcon.tsx";
import { authClient, useUser } from "./auth-client.ts";
import { providersInfo } from "./providers.tsx";
import { Dialog } from "@/components/ui/dialog.tsx";
import { usePageTitle } from "@/hooks/usePageTitle.ts";
import { logger } from "@/logger.ts";

async function signInWithPasskey(returnToURL: string) {
  const result = await authClient.signIn.passkey();
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
  if (window.Native) {
    window.Native.reportUnauthorized();
    throw new Error("Auth page loaded in native");
  }

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
          {process.env.NODE_ENV === "development" && <DevImpersonateTarget />}
        </p>
      </div>
    </div>
  );
}

function DevImpersonateTarget() {
  return (
    <Dialog>
      <Dialog.Trigger asChild>
        <span className="mx-1">
          [<button className="link">dev-impersonate</button>]
        </span>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Dev impersonate</Dialog.Title>
        <Dialog.Description>
          (Only available in development) Sign in as any user.
        </Dialog.Description>
        <DevImpersonatePanel />
      </Dialog.Content>
    </Dialog>
  );
}

function DevImpersonatePanel() {
  const user = useUser();

  const users = useQuery({
    queryKey: ["dev-impersonate", "users"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/_dev-impersonate/users");
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await res.json();
      return data as { id: string; email: string }[];
    },
  });

  const impersonateUser = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/v1/auth/_dev-impersonate/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        throw new Error("Failed to impersonate user");
      }
    },
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">Current user: {user?.email ?? "None"}</p>
      {users.isLoading && <p>Loading users...</p>}
      <ul className="max-h-60 list-inside list-disc overflow-y-auto">
        {users.data?.map(user => (
          <li key={user.id}>
            <button
              className="link cursor-pointer text-base leading-relaxed disabled:cursor-not-allowed disabled:opacity-50"
              disabled={impersonateUser.isPending}
              onClick={() => impersonateUser.mutate(user.id)}>
              {user.email}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
