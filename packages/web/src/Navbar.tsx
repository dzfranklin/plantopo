import { Link } from "react-router-dom";

import { signOut, useSession } from "./auth/auth-client";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="flex items-center gap-3 px-4 py-2 text-sm">
      <Link className="font-semibold" to="/">
        PlanTopo
      </Link>

      {!session && !window.Native && (
        <Link
          to="/login"
          className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
        >
          Sign in
        </Link>
      )}

      {session && (
        <>
          {session.user.image && (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              className="w-7 h-7 rounded-full object-cover"
            />
          )}
          <span>{session.user.name}</span>
          <button
            onClick={signOut}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
          >
            Sign out
          </button>
        </>
      )}
    </nav>
  );
}
