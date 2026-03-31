import { RiMenuLine } from "@remixicon/react";
import { VisuallyHidden } from "radix-ui";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useMatch } from "react-router-dom";
import { Drawer } from "vaul";

import { signOut, useSession } from "../auth/auth-client";
import { useNavTabs } from "./tabs";
import { Button } from "@/components/ui/button";

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
      className={`flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 ${active ? "font-medium text-gray-900" : "text-gray-700"}`}>
      {icon}
      {label}
    </Link>
  );
}

export function MobileMenuSheet({
  setDebugOpen,
}: {
  setDebugOpen: (open: boolean) => void;
}) {
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
      <Drawer.Trigger className="flex items-center text-gray-600 hover:text-gray-900">
        <RiMenuLine size={20} aria-hidden="true" />
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
                icon={tab.icon}
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

          {window.Native && (
            <div className="flex flex-col px-2 pb-2">
              <hr className="my-2" />
              <Button variant="secondary" onClick={() => setDebugOpen(true)}>
                Debug
              </Button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
