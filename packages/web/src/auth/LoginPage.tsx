import React from "react";
import { useSearchParams } from "react-router-dom";

import { GitHubIcon } from "./GitHubIcon.tsx";
import { GoogleIcon } from "./GoogleIcon.tsx";
import { authClient } from "./auth-client.ts";

function SocialButton({
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
      className="flex h-10 w-62.5 items-center justify-center gap-4 rounded-sm border border-gray-200 bg-white px-4 shadow-sm transition-colors hover:bg-gray-50"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export default function LoginPage() {
  if (window.Native) throw new Error("Login page loaded in native");

  const [searchParams] = useSearchParams();
  const callbackURL = searchParams.get("returnTo") ?? "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <h1 className="mb-10 text-2xl font-semibold text-gray-900">PlanTopo</h1>
      <div className="flex w-87.5 flex-col items-center gap-3">
        <SocialButton
          icon={<GoogleIcon />}
          label="Sign in with Google"
          onClick={() =>
            authClient.signIn.social({ provider: "google", callbackURL })
          }
        />
        <SocialButton
          icon={<GitHubIcon />}
          label="Sign in with GitHub"
          onClick={() =>
            authClient.signIn.social({
              provider: "github",
              callbackURL,
            })
          }
        />
      </div>
    </div>
  );
}
