import { RiMenuLine } from "@remixicon/react";
import { VisuallyHidden } from "radix-ui";
import { useEffect, useState } from "react";
import { Link, useLocation, useMatch } from "react-router-dom";
import { Drawer } from "vaul";

import { signOut, useSession } from "../auth/auth-client";
import { FooterLinkComponent } from "./Navbar";
import { FOOTER_LINKS, type NavTab, useNavTabs } from "./nav";
import { cn } from "@/cn";
import { Button } from "@/components/ui/button";
import { setDebugFlag, useDebugFlag } from "@/hooks/debug-flags";

function MobileMenuSheetTab({
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
      className={`flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 ${active ? "font-medium text-gray-900" : "text-gray-700"}`}>
      <Icon size={20} aria-hidden />
      {label}
    </Link>
  );
}

export function MenuSheet({ fab = false }: { fab?: boolean }) {
  const mayShowDebug = useDebugFlag("showDebugOptions");
  const { data: session } = useSession();
  const navTabs = useNavTabs({ includeSettings: true });
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [location]);

  return (
    <Drawer.Root direction="left" autoFocus open={open} onOpenChange={setOpen}>
      <Drawer.Trigger
        className={cn(
          "flex items-center justify-center text-gray-500 transition-colors",
          fab
            ? "h-11 w-11 rounded-full bg-white shadow-md active:bg-gray-100"
            : "h-8 w-8 rounded-md hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200",
        )}>
        <RiMenuLine size={22} aria-hidden="true" />
        <span className="sr-only">Open menu</span>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <VisuallyHidden.Root>
          <Drawer.Title>Menu</Drawer.Title>
          <Drawer.Description>Navigation menu</Drawer.Description>
        </VisuallyHidden.Root>
        <Drawer.Content className="fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col gap-0 bg-white">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Link className="px-4 pt-3 pb-0.5 font-semibold" to="/">
              PlanTopo
            </Link>
            <hr className="my-2" />
            {navTabs.map(tab => (
              <MobileMenuSheetTab
                key={tab.to}
                to={tab.to}
                label={tab.label}
                Icon={tab.Icon}
              />
            ))}
          </div>

          <div className="mt-auto flex flex-col">
            <hr className="my-2" />
            {session ? (
              <div className="flex flex-col gap-2 p-2">
                <div className="flex items-center gap-3">
                  {session.user.image && (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? ""}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {session.user.name}
                    </div>
                    <div className="truncate text-xs text-gray-500">
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
                <div className="flex flex-row gap-2 px-4 py-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link to="/signup">Sign up</Link>
                  </Button>
                </div>
              )
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 px-4 py-2 text-xs text-gray-500">
            {FOOTER_LINKS.map((link, i) => (
              <FooterLinkComponent key={i} link={link} />
            ))}

            {mayShowDebug && (
              <span className="ml-auto text-gray-500">
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
