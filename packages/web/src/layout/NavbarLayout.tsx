import { Outlet } from "react-router-dom";

import { cn } from "../lib/utils.ts";
import { Navbar, NavbarMobileFooter } from "./Navbar.tsx";

export function NavbarLayout() {
  return (
    <div
      className={cn(
        "grid min-h-svh",
        "[grid-template-areas:'header_header''content_content''footer_footer'] grid-rows-[auto_1fr_auto]",
        "sm:[grid-template-areas:'header_header''content_content'] sm:grid-rows-[auto_1fr]",
      )}
    >
      <Navbar />
      <div style={{ gridArea: "content" }}>
        <Outlet />
      </div>
      <NavbarMobileFooter />
    </div>
  );
}
