import { Outlet } from "react-router-dom";

import { OfflineIndicator } from "../components/OfflineIndicator.tsx";
import { cn } from "../util/cn.ts";
import { DebugDialog } from "./DebugDialog.tsx";
import { MenuSheet } from "./MenuSheet.tsx";
import { DesktopFooter, MobileBottomNav, Navbar } from "./Navbar.tsx";

export function NavbarLayout({ fullBleed = false }: { fullBleed?: boolean }) {
  return (
    <div
      className={cn(
        "grid h-svh",
        "grid-rows-[auto_1fr_auto] [grid-template-areas:'header_header''content_content''footer_footer']",
        "sm:grid-rows-[auto_1fr_auto] sm:[grid-template-areas:'header_header''content_content''footer_footer']",
      )}>
      {fullBleed ? (
        <div className="max-sm:hidden sm:contents">
          <Navbar />
        </div>
      ) : (
        <Navbar />
      )}
      <div
        style={{ gridArea: "content" }}
        className="relative h-full min-h-0 overflow-y-auto">
        {fullBleed && (
          <div className="absolute top-3 left-3 z-10 flex items-center sm:hidden">
            <MenuSheet fab />
            <OfflineIndicator fullbleed className="ml-2" />
          </div>
        )}
        <Outlet />
      </div>
      <MobileBottomNav />
      {!fullBleed && <DesktopFooter />}
      <DebugDialog />
    </div>
  );
}
