import { RiBrushLine, RiUserLine } from "@remixicon/react";
import { NavLink, Outlet } from "react-router-dom";

import { UserAvatar } from "@/auth/UserAvatar";
import { useRequiredSession } from "@/auth/auth-client";
import { cn } from "@/cn";

const navItems = [
  { to: "/settings/account", label: "Account", icon: RiUserLine },
  { to: "/settings/interface", label: "Interface", icon: RiBrushLine },
];

export default function SettingsPage() {
  const { user } = useRequiredSession();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8">
      <div className="mb-6 flex items-center gap-4">
        <UserAvatar user={user} className="h-10 w-10 text-base" />
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <nav className="shrink-0 sm:w-48">
          <ul className="flex flex-row gap-1 sm:flex-col">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    )
                  }>
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
