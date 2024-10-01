'use client';

import { NavbarItem, NavbarSection } from '@/components/navbar';
import { SidebarItem, SidebarSection } from '@/components/sidebar';
import { useLogoutMutation, useUser } from '@/features/users/queries';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownIcon,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/dropdown';
import {
  ArrowRightStartOnRectangleIcon,
  Cog8ToothIcon,
} from '@heroicons/react/20/solid';
import { Button } from '@/components/button';

interface NavItem {
  label: string;
  url: string;
}

function useNavItems(): NavItem[] {
  const user = useUser();
  if (user) {
    return [
      { label: 'Home', url: '/' },
      { label: 'Tracks', url: '/tracks' },
      { label: 'Tools', url: '/tools' },
    ];
  } else {
    return [
      { label: 'Home', url: '/' },
      { label: 'Map', url: '/map' },
      { label: 'Tools', url: '/tools' },
    ];
  }
}

export function NavbarNavItemsSection() {
  const navItems = useNavItems();
  return (
    <NavbarSection className="max-lg:hidden">
      {navItems.map(({ label, url }) => (
        <NavbarItem key={label} href={url}>
          {label}
        </NavbarItem>
      ))}
    </NavbarSection>
  );
}

export function SidebarNavItemsSection() {
  const navItems = useNavItems();
  return (
    <SidebarSection>
      {navItems.map(({ label, url }) => (
        <SidebarItem key={label} href={url}>
          {label}
        </SidebarItem>
      ))}
    </SidebarSection>
  );
}

export function NavbarUserSection() {
  const user = useUser();
  const logoutMutation = useLogoutMutation();

  if (!user) {
    return (
      <NavbarSection>
        <Button href="/login">Login</Button>
        <Button color="primary" href="/signup">
          Signup
        </Button>
      </NavbarSection>
    );
  }

  return (
    <NavbarSection>
      <Dropdown>
        <DropdownButton plain={true}>
          {user.name}
          <DropdownIcon />
        </DropdownButton>
        <DropdownMenu className="min-w-64" anchor="bottom end">
          <DropdownItem href="/settings">
            <Cog8ToothIcon />
            <DropdownLabel>Settings</DropdownLabel>
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem onClick={() => logoutMutation.mutate({})}>
            <ArrowRightStartOnRectangleIcon />
            <DropdownLabel>Sign out</DropdownLabel>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </NavbarSection>
  );
}

export function SidebarUserSection() {
  // Our layout shows the NavbarUserSection even in sidebar mode so we just
  // duplicate the most important actions

  const user = useUser();

  if (!user) {
    return (
      <SidebarSection>
        <Button href="/login" className="mb-2">
          Login
        </Button>
        <Button color="primary" href="/signup">
          Signup
        </Button>
      </SidebarSection>
    );
  }

  return null;
}
