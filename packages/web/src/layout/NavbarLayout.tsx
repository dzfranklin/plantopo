import { useState } from "react";
import { Outlet } from "react-router-dom";

import { cn } from "../cn.ts";
import { DebugDialog } from "./DebugDialog.tsx";
import { MenuSheet } from "./MenuSheet.tsx";
import { DesktopFooter, MobileFooter, Navbar } from "./Navbar.tsx";

export function NavbarLayout({ fullBleed = false }: { fullBleed?: boolean }) {
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <div
      className={cn(
        "grid h-svh",
        "grid-rows-[auto_1fr_auto] [grid-template-areas:'header_header''content_content''footer_footer']",
        "sm:grid-rows-[auto_1fr_auto] sm:[grid-template-areas:'header_header''content_content''footer_footer']",
      )}>
      {fullBleed ? (
        <div className="max-sm:hidden sm:contents">
          <Navbar setDebugOpen={setDebugOpen} />
        </div>
      ) : (
        <Navbar setDebugOpen={setDebugOpen} />
      )}
      <DebugDialog isOpen={debugOpen} onOpenChange={setDebugOpen} />
      <div
        style={{ gridArea: "content" }}
        className="relative h-full min-h-0 overflow-y-auto">
        {fullBleed && (
          <div className="absolute top-3 left-3 z-10 sm:hidden">
            <MenuSheet setDebugOpen={setDebugOpen} fab />
          </div>
        )}
        <Outlet />
      </div>
      <MobileFooter />
      {!fullBleed && <DesktopFooter />}
    </div>
  );
}
