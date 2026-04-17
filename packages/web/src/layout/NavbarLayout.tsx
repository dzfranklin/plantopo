import { Outlet } from "react-router-dom";

import { cn } from "../cn.ts";
import { DesktopFooter, MobileFooter, Navbar } from "./Navbar.tsx";

export function NavbarLayout({ fullBleed = false }: { fullBleed?: boolean }) {
  return (
    <div
      className={cn(
        "grid h-svh",
        "grid-rows-[auto_1fr_auto] [grid-template-areas:'header_header''content_content''footer_footer']",
        "sm:grid-rows-[auto_1fr_auto] sm:[grid-template-areas:'header_header''content_content''footer_footer']",
      )}>
      <Navbar />
      <div
        style={{ gridArea: "content" }}
        className="h-full min-h-0 overflow-y-auto">
        <Outlet />
      </div>
      <MobileFooter />
      {!fullBleed && <DesktopFooter />}
    </div>
  );
}
