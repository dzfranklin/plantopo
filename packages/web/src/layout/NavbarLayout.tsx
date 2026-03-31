import { Outlet } from "react-router-dom";

import { cn } from "../cn.ts";
import { Navbar, NavbarMobileFooter } from "./Navbar.tsx";

export function NavbarLayout() {
  return (
    <div
      className={cn(
        "grid min-h-svh",
        "grid-rows-[auto_1fr_auto] [grid-template-areas:'header_header''content_content''footer_footer']",
        "sm:grid-rows-[auto_1fr] sm:[grid-template-areas:'header_header''content_content']",
      )}>
      <Navbar />
      <div style={{ gridArea: "content" }}>
        <Outlet />
      </div>
      <NavbarMobileFooter />
    </div>
  );
}
