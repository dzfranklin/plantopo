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
import { ChevronDownIcon } from '@heroicons/react/16/solid';
import { Button } from '@/components/button';

interface BasicNavItem {
  label: string;
  url: string;
}

type NavItem = BasicNavItem | { label: string; dropdown: BasicNavItem[] };

function useNavItems(): NavItem[] {
  const user = useUser();
  const items: NavItem[] = [];
  items.push({ label: 'Home', url: '/' });
  items.push({ label: 'Map', url: '/map' });
  if (user) {
    items.push({ label: 'Tracks', url: '/tracks' });
  }
  items.push({ label: 'Tools', url: '/tools' });
  items.push({
    label: 'About',
    dropdown: [
      { label: 'Status', url: 'https://status.plantopo.com' },
      { label: 'Source', url: 'https://github.com/dzfranklin/plantopo' },
      { label: 'Credits', url: '/credits' },
    ],
  });
  return items;
}

export function NavbarNavItemsSection() {
  const navItems = useNavItems();
  return (
    <NavbarSection className="max-lg:hidden">
      {navItems.map((n, i) =>
        'url' in n ? (
          <NavbarItem key={i} href={n.url}>
            {n.label}
          </NavbarItem>
        ) : (
          <Dropdown key={i}>
            <DropdownButton as={NavbarItem}>
              {n.label}
              <ChevronDownIcon />
            </DropdownButton>
            <DropdownMenu>
              {n.dropdown.map((v) => (
                <DropdownItem key={v.url} href={v.url}>
                  {v.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        ),
      )}
    </NavbarSection>
  );
}

export function SidebarNavItemsSection() {
  const navItems = useNavItems();
  return (
    <SidebarSection>
      {navItems.map((n, i) =>
        'url' in n ? (
          <SidebarItem key={i} href={n.url}>
            {n.label}
          </SidebarItem>
        ) : (
          <Dropdown key={i}>
            <DropdownButton as={SidebarItem}>
              {n.label}
              <ChevronDownIcon />
            </DropdownButton>
            <DropdownMenu className="min-w-52" anchor="bottom start">
              {n.dropdown.map((v) => (
                <DropdownItem key={v.url} href={v.url}>
                  {v.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        ),
      )}
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
