import { forwardRef } from 'react';
import { PageTitle } from './PageTitle';
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
import Footer from './Footer';
import cls from '@/cls';

const navItems = [
  { label: 'Home', url: '/' },
  { label: 'My Tracks', url: '/tracks' },
  { label: 'Tools', url: '/tools' },
];

export const Layout = forwardRef(
  (
    {
      children,
      pageTitle,
      pageActions,
      wide,
      inlineTitle,
      ...props
    }: {
      children?: React.ReactNode;
      pageTitle?: string;
      inlineTitle?: boolean;
      pageActions?: React.ReactNode;
      wide?: boolean;
    } & React.ComponentPropsWithoutRef<'div'>,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    return (
      <div className="grid grid-cols-1 grid-rows-[minmax(0,1fr)_min-content] min-h-svh">
        <StackedLayout
          wide={wide}
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
                {/*{user ? (*/}
                {/*  <Dropdown>*/}
                {/*    <DropdownButton as={NavbarItem}>*/}
                {/*      <Avatar*/}
                {/*        src={user.profilePictureUrl}*/}
                {/*        firstName={user.firstName ?? undefined}*/}
                {/*        lastName={user.lastName ?? undefined}*/}
                {/*        square*/}
                {/*      />*/}
                {/*    </DropdownButton>*/}
                {/*    <DropdownMenu className="min-w-64" anchor="bottom end">*/}
                {/*      <Headless.MenuItem>*/}
                {/*        <DropdownLabel className="text-zinc-950/80 text-sm mt-2 mb-1">*/}
                {/*          {user.firstName} {user.lastName}*/}
                {/*        </DropdownLabel>*/}
                {/*      </Headless.MenuItem>*/}
                {/*      <DropdownItem href="/settings">*/}
                {/*        <Cog8ToothIcon />*/}
                {/*        <DropdownLabel>Settings</DropdownLabel>*/}
                {/*      </DropdownItem>*/}
                {/*      <DropdownDivider />*/}
                {/*      <DropdownItem href="/auth/logout">*/}
                {/*        <ArrowRightStartOnRectangleIcon />*/}
                {/*        <DropdownLabel>Sign out</DropdownLabel>*/}
                {/*      </DropdownItem>*/}
                {/*    </DropdownMenu>*/}
                {/*  </Dropdown>*/}
                {/*) : (*/}
                {/*  <>*/}
                {/*    <NavbarItem href={signInUrl}>Sign in</NavbarItem>*/}
                {/*    <NavbarItem href={signUpUrl}>Sign up</NavbarItem>*/}
                {/*  </>*/}
                {/*)}*/}
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
          <PageTitle
            title={pageTitle}
            actions={pageActions}
            inlineTitle={inlineTitle}
          />

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
