import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ReactNode, useState } from "react";
import { Link, useMatch } from "react-router-dom";

import { signOut, useSession } from "../auth/auth-client";
import { DebugDialog } from "./DebugDialog";
import { MobileMenuSheet } from "./MobileMenuSheet";
import { useNavTabs } from "./tabs";

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

function UserMenuDesktop({
  setDebugOpen,
}: {
  setDebugOpen: (open: boolean) => void;
}) {
  const { data: session } = useSession();
  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer transition-colors">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
            {session.user.name?.[0]?.toUpperCase()}
          </div>
        )}
        <span>{session.user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem disabled>
          <span className="truncate">{session.user.email}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setDebugOpen(true)}>
          Debug
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navbar() {
  const { data: session } = useSession();
  const navTabs = useNavTabs();
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <nav
      style={{ gridArea: "header" }}
      className="flex items-center gap-3 px-4 py-2 text-sm border-b border-gray-200"
    >
      <div className="sm:hidden">
        <MobileMenuSheet setDebugOpen={setDebugOpen} />
      </div>

      <Link className="hidden sm:block font-semibold" to="/">
        PlanTopo
      </Link>

      <div className="hidden sm:flex items-center gap-1">
        {navTabs.map((tab) => (
          <DesktopNavTab key={tab.to} to={tab.to} label={tab.label} />
        ))}
      </div>

      <div className="ml-auto hidden sm:block">
        <UserMenuDesktop setDebugOpen={setDebugOpen} />
      </div>

      {!session && !window.Native && (
        <div className="ml-auto">
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      )}

      <DebugDialog isOpen={debugOpen} onOpenChange={setDebugOpen} />
    </nav>
  );
}

export function NavbarMobileFooter() {
  const navTabs = useNavTabs();
  return (
    <nav
      style={{ gridArea: "footer" }}
      className="flex sm:hidden border-t border-gray-200 bg-white sticky bottom-0"
    >
      {navTabs.map((tab) => (
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
