import { Link, useMatch } from "react-router-dom";

import { signOut, useSession } from "../auth/auth-client";
import { MenuSheet } from "./MenuSheet";
import { FOOTER_LINKS, type FooterLink, type NavTab, useNavTabs } from "./nav";
import { UserAvatar } from "@/auth/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setDebugFlag, useDebugFlag } from "@/hooks/debug-flags";

function DesktopNavTab({ to, label }: { to: string; label: string }) {
  const active = useMatch(to);
  return (
    <Link
      to={to}
      className={`rounded px-3 py-1 text-sm ${active ? "font-medium text-gray-900" : "text-gray-500 hover:text-gray-900"}`}>
      {label}
    </Link>
  );
}

function MobileNavTab({
  to,
  label,
  Icon,
}: {
  to: string;
  label: string;
  Icon: NavTab["Icon"];
}) {
  const active = useMatch(to);
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs ${active ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}>
      <Icon size={24} aria-hidden />
      {label}
    </Link>
  );
}

function UserMenuDesktop() {
  const mayShowDebug = useDebugFlag("showDebugOptions");
  const { data: session } = useSession();
  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
        <UserAvatar user={session.user} />
        <span className="max-w-42 truncate">{session.user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 text-base">
        <DropdownMenuItem disabled>
          <span className="truncate text-xs">{session.user.email}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="text-sm/relaxed" asChild>
          <Link to="/settings">Settings</Link>
        </DropdownMenuItem>
        {mayShowDebug && (
          <DropdownMenuItem
            className="text-sm/relaxed"
            onClick={() => setDebugFlag("showDebugOptions", true)}>
            Debug
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-sm/relaxed" onClick={signOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navbar() {
  const { data: session } = useSession();
  const navTabs = useNavTabs();

  return (
    <nav
      style={{ gridArea: "header" }}
      className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 text-sm">
      <div className="sm:hidden">
        <MenuSheet />
      </div>

      <Link className="hidden font-semibold sm:block" to="/">
        PlanTopo
      </Link>

      <div className="hidden items-center gap-1 sm:flex">
        {navTabs.map(tab => (
          <DesktopNavTab key={tab.to} to={tab.to} label={tab.label} />
        ))}
      </div>

      <div className="ml-auto hidden sm:block">
        <UserMenuDesktop />
      </div>

      {!session && !window.Native && (
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Sign up</Link>
          </Button>
        </div>
      )}
    </nav>
  );
}

export function DesktopFooter() {
  const mayShowDebug = useDebugFlag("showDebugOptions");
  return (
    <footer
      style={{ gridArea: "footer" }}
      className="hidden bg-gray-100 px-4 py-2 text-xs text-gray-800 sm:flex">
      <div className="ml-auto flex gap-3">
        {FOOTER_LINKS.map((link, i) => (
          <FooterLinkComponent key={i} link={link} />
        ))}

        {mayShowDebug && (
          <span className="text-gray-500">
            <span>|</span>
            <FooterLinkComponent
              link={{
                onClick: () => setDebugFlag("openDebugDialog", true),
                label: "Debug",
              }}
            />
            <span>|</span>
          </span>
        )}
      </div>
    </footer>
  );
}

export function FooterLinkComponent({ link }: { link: FooterLink }) {
  return "to" in link ? (
    <Link to={link.to} className="hover-only-link">
      {link.label}
    </Link>
  ) : (
    <button onClick={link.onClick} className="hover-only-link">
      {link.label}
    </button>
  );
}

export function MobileFooter() {
  const navTabs = useNavTabs();
  return (
    <nav
      style={{ gridArea: "footer" }}
      className="sticky bottom-0 flex border-t border-gray-200 bg-white sm:hidden">
      {navTabs.map(tab => (
        <MobileNavTab
          key={tab.to}
          to={tab.to}
          label={tab.label}
          Icon={tab.Icon}
        />
      ))}
    </nav>
  );
}
