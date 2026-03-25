import { Link } from "react-router-dom";

import { signOut, useSession } from "./auth/auth-client";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav>
      <span>PlanTopo</span>{" "}
      {session ? (
        <>
          {session.user.image && (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          )}
          <span>{session.user.name}</span>
          <button onClick={signOut}>Sign out</button>
        </>
      ) : (
        <Link to="/login">Sign in</Link>
      )}
    </nav>
  );
}
