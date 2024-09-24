import { Navbar, NavbarLabel, NavbarSpacer } from '@/components/navbar';
import { Logo } from '@/components/Logo';
import {
  NavbarNavItemsSection,
  NavbarUserSection,
  SidebarNavItemsSection,
  SidebarUserSection,
} from '@/components/Layout/ClientNav';
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarLabel,
  SidebarSpacer,
} from '@/components/sidebar';

export function PNavbar() {
  return (
    <Navbar>
      <NavbarLabel>
        <Logo />
      </NavbarLabel>
      <NavbarNavItemsSection />
      <NavbarSpacer />
      <NavbarUserSection />
    </Navbar>
  );
}

export function PSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarLabel>
          <Logo />
        </SidebarLabel>
      </SidebarHeader>
      <SidebarBody>
        <SidebarNavItemsSection />
        <SidebarSpacer />
        <SidebarUserSection />
      </SidebarBody>
    </Sidebar>
  );
}
