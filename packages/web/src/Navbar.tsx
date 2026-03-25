import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RiGridLine, RiMenuLine, RiRecordCircleLine } from "@remixicon/react";
import { VisuallyHidden } from "radix-ui";
import { type ReactNode, useState } from "react";
import { Link, useMatch } from "react-router-dom";
import { Drawer } from "vaul";

import { signOut, useSession } from "./auth/auth-client";

interface NavTab {
  to: string;
  label: string;
  icon: ReactNode;
  requireAuth?: boolean;
}

const NAV_TABS: NavTab[] = [
  {
    to: "/counter",
    label: "Counter",
    icon: <RiGridLine size={24} aria-hidden="true" />,
    requireAuth: true,
  },
  {
    to: "/record-track",
    label: "Track",
    icon: <RiRecordCircleLine size={24} aria-hidden="true" />,
    requireAuth: true,
  },
];

const UNAUTH_NAV_TABS: NavTab[] = NAV_TABS.filter((tab) => !tab.requireAuth);

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

function UserMenuDesktop() {
  const { data: session } = useSession();
  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
        {session.user.image && (
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="w-5 h-5 rounded-full object-cover"
          />
        )}
        <span>{session.user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenuSheetTab({
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
      className={`flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 ${active ? "font-medium text-gray-900" : "text-gray-700"}`}
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileMenuSheet() {
  const { data: session } = useSession();
  const navTabs = session ? NAV_TABS : UNAUTH_NAV_TABS;
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <Drawer.Root direction="left" autoFocus>
      <Drawer.Trigger className="flex items-center text-gray-600 hover:text-gray-900">
        <RiMenuLine size={20} aria-hidden="true" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <VisuallyHidden.Root>
          <Drawer.Title>Menu</Drawer.Title>
          <Drawer.Description>Navigation menu</Drawer.Description>
        </VisuallyHidden.Root>
        <Drawer.Content className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col gap-0 bg-white">
          <div className="flex flex-col">
            <Link className="px-4 pt-3 pb-0.5 font-semibold" to="/">
              PlanTopo
            </Link>
            <hr className="my-2" />
            {navTabs.map((tab) => (
              <MobileMenuSheetTab
                key={tab.to}
                to={tab.to}
                label={tab.label}
                icon={tab.icon}
              />
            ))}
          </div>

          <div className="mt-auto flex flex-col">
            <hr className="my-2" />
            {session ? (
              <div className="flex flex-col p-2 gap-2">
                <div className="flex items-center gap-3">
                  {session.user.image && (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? ""}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {session.user.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {session.user.email}
                    </div>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => signOut()}>
                  Sign out
                </Button>
              </div>
            ) : (
              !window.Native && (
                <div className="flex flex-col px-4 py-2">
                  <Button asChild className="w-full">
                    <Link to="/login">Sign in</Link>
                  </Button>
                </div>
              )
            )}
          </div>

          {window.Native && import.meta.env.DEV && (
            <div className="flex flex-col px-2 pb-2">
              <hr className="my-2" />
              <Button variant="secondary" onClick={() => setDebugOpen(true)}>
                Debug
              </Button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Debug</DialogTitle>
          </DialogHeader>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </DialogContent>
      </Dialog>
    </Drawer.Root>
  );
}

export function Navbar() {
  const session = useSession().data;
  const navTabs = session ? NAV_TABS : UNAUTH_NAV_TABS;

  return (
    <nav
      style={{ gridArea: "header" }}
      className="flex items-center gap-3 px-4 py-2 text-sm border-b border-gray-200"
    >
      <div className="sm:hidden">
        <MobileMenuSheet />
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
        <UserMenuDesktop />
      </div>

      {!session && !window.Native && (
        <div className="ml-auto">
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      )}
    </nav>
  );
}

export function NavbarMobileFooter() {
  const session = useSession().data;
  const navTabs = session ? NAV_TABS : UNAUTH_NAV_TABS;

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
