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
    <div className="m-8 mx-auto w-full max-w-4xl">
      <div className="mb-8 flex items-center gap-4">
        <UserAvatar user={user} className="h-10 w-10 text-base" />
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>
      <div className="flex gap-8">
        <nav className="w-48 shrink-0">
          <ul className="flex flex-col gap-1">
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
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
