import { type ReactNode } from "react";
import { Link, useMatch } from "react-router-dom";

import { signOut, useSession } from "./auth/auth-client";

const NAV_TABS: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: "/counter",
    label: "Counter",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3h7v7H3z" />
        <path d="M14 3h7v7h-7z" />
        <path d="M14 14h7v7h-7z" />
        <path d="M3 14h7v7H3z" />
      </svg>
    ),
  },
  {
    to: "/record-track",
    label: "Track",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

function DesktopNavTab({ to, label }: { to: string; label: string }) {
  const active = useMatch(to);
  return (
    <Link
      to={to}
      className={`px-3 py-1 text-sm rounded ${active ? "font-medium text-gray-900" : "text-gray-500 hover:text-gray-900"}`}
    >
      {label}
    </Link>
  );
}

function MobileNavTab({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: ReactNode;
}) {
  const active = useMatch(to);
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs ${active ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
    >
      {icon}
      {label}
    </Link>
  );
}

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav
      style={{ gridArea: "header" }}
      className="flex items-center gap-3 px-4 py-2 text-sm border-b border-gray-200"
    >
      <Link className="hidden sm:block font-semibold" to="/">
        PlanTopo
      </Link>

      <div className="hidden sm:flex items-center gap-1">
        {NAV_TABS.map((tab) => (
          <DesktopNavTab key={tab.to} to={tab.to} label={tab.label} />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
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
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span>{session.user.name}</span>
            <button
              onClick={signOut}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-100"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

export function NavbarFooter() {
  return (
    <nav
      style={{ gridArea: "footer" }}
      className="flex sm:hidden border-t border-gray-200 bg-white"
    >
      {NAV_TABS.map((tab) => (
        <MobileNavTab
          key={tab.to}
          to={tab.to}
          label={tab.label}
          icon={tab.icon}
        />
      ))}
    </nav>
  );
}
