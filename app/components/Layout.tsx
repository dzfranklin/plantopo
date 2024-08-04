import { forwardRef } from 'react';
import { PageTitle } from './PageTitle';
import * as Headless from '@headlessui/react';

import { Avatar } from '@/components/avatar';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/dropdown';
import {
  Navbar,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from '@/components/navbar';
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/components/sidebar';
import { StackedLayout } from '@/components/stacked-layout';
import {
  ArrowRightStartOnRectangleIcon,
  Cog8ToothIcon,
} from '@heroicons/react/16/solid';
import {
  getSignInUrl,
  getSignUpUrl,
  getUser,
  Impersonation,
} from '@workos-inc/authkit-nextjs';
import Footer from './Footer';
import cls from '@/cls';

const navItems = [
  { label: 'Home', url: '/' },
  { label: 'My Tracks', url: '/tracks' },
];

export const Layout = forwardRef(
  async (
    {
      children,
      pageTitle,
      pageActions,
      ...props
    }: {
      children?: React.ReactNode;
      pageTitle?: string;
      pageActions?: React.ReactNode;
    } & React.ComponentPropsWithoutRef<'div'>,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    const { user } = await getUser();
    const signInUrl = await getSignInUrl();
    const signUpUrl = await getSignUpUrl();

    return (
      <div className="grid grid-cols-1 grid-rows-[minmax(0,1fr)_min-content] min-h-svh">
        <StackedLayout
          navbar={
            <Navbar>
              <NavbarSection>
                <NavbarLabel>PlanTopo</NavbarLabel>
              </NavbarSection>
              <NavbarSection className="max-lg:hidden">
                {navItems.map(({ label, url }) => (
                  <NavbarItem key={label} href={url}>
                    {label}
                  </NavbarItem>
                ))}
              </NavbarSection>
              <NavbarSpacer />
              <NavbarSection>
                {user ? (
                  <Dropdown>
                    <DropdownButton as={NavbarItem}>
                      <Avatar
                        src={user.profilePictureUrl}
                        firstName={user.firstName ?? undefined}
                        lastName={user.lastName ?? undefined}
                        square
                      />
                    </DropdownButton>
                    <DropdownMenu className="min-w-64" anchor="bottom end">
                      <Headless.MenuItem>
                        <DropdownLabel className="text-zinc-950/80 text-sm mt-2 mb-1">
                          {user.firstName} {user.lastName}
                        </DropdownLabel>
                      </Headless.MenuItem>
                      <DropdownItem href="/settings">
                        <Cog8ToothIcon />
                        <DropdownLabel>Settings</DropdownLabel>
                      </DropdownItem>
                      <DropdownDivider />
                      <DropdownItem href="/auth/logout">
                        <ArrowRightStartOnRectangleIcon />
                        <DropdownLabel>Sign out</DropdownLabel>
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                ) : (
                  <>
                    <NavbarItem href={signInUrl}>Sign in</NavbarItem>
                    <NavbarItem href={signUpUrl}>Sign up</NavbarItem>
                  </>
                )}
              </NavbarSection>
            </Navbar>
          }
          sidebar={
            <Sidebar>
              <SidebarHeader>
                <SidebarLabel>PlanTopo</SidebarLabel>
              </SidebarHeader>
              <SidebarBody>
                <SidebarSection>
                  {navItems.map(({ label, url }) => (
                    <SidebarItem key={label} href={url}>
                      {label}
                    </SidebarItem>
                  ))}
                </SidebarSection>
              </SidebarBody>
            </Sidebar>
          }
        >
          <Impersonation />
          <PageTitle title={pageTitle} actions={pageActions} />
          <div {...props} className={cls('grow', props.className)} ref={ref}>
            {children}
          </div>
        </StackedLayout>
        <Footer />
      </div>
    );
  },
);
Layout.displayName = 'Layout';
