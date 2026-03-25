import { useSearchParams } from "react-router-dom";

import { authClient } from "./auth-client.ts";

export default function Login() {
  const [searchParams] = useSearchParams();
  const callbackURL = searchParams.get("returnTo") ?? "/";

  return (
    <div>
      <h1>Sign in to PlanTopo</h1>
      <button
        onClick={() =>
          authClient.signIn.social({ provider: "google", callbackURL })
        }
      >
        Continue with Google
      </button>
      <button
        onClick={() =>
          authClient.signIn.social({ provider: "github", callbackURL })
        }
      >
        Continue with GitHub
      </button>
    </div>
  );
}
