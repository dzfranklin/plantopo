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
      className="flex gap-4 justify-center items-center w-62.5 h-10 px-4 rounded-sm shadow-sm border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const callbackURL = searchParams.get("returnTo") ?? "/";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-900 mb-10">PlanTopo</h1>
      <div className="w-87.5 flex flex-col items-center gap-3">
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
