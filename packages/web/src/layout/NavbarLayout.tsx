import { Link, Outlet } from "react-router-dom";

import { cn } from "../cn.ts";
import { Navbar, NavbarMobileFooter } from "./Navbar.tsx";
import { FOOTER_LINKS } from "./nav.tsx";

export function NavbarLayout() {
  return (
    <div
      className={cn(
        "grid h-svh",
        "grid-rows-[auto_1fr_auto] [grid-template-areas:'header_header''content_content''footer_footer']",
        "sm:grid-rows-[auto_1fr_auto] sm:[grid-template-areas:'header_header''content_content''footer_footer']",
      )}>
      <Navbar />
      <div style={{ gridArea: "content" }} className="h-full min-h-0">
        <Outlet />
      </div>
      <NavbarMobileFooter />
      <footer
        style={{ gridArea: "footer" }}
        className="hidden border-t border-gray-100 px-4 py-2 sm:flex">
        <div className="flex gap-3 text-xs text-gray-400">
          {FOOTER_LINKS.map(link => (
            <Link key={link.to} to={link.to} className="hover:text-gray-600">
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
