import cls from '@/generic/cls';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { useSession } from '../account/session';
import { useLogoutMutation } from '../account/api/useSessionMutation';
import { UserImage } from '../account/UserImage';

type NavAction = 'signOut';
type NavEntry = { name: string } & ({ path: string } | { action: NavAction });

const sessionNav: NavEntry[] = [{ name: 'Dashboard', path: '/dashboard' }];
const userNav: NavEntry[] = [
  { name: 'Account', path: '/account' },
  { name: 'Sign out', action: 'signOut' },
];

export default function Nav() {
  return (
    <Disclosure as="nav" className="bg-gray-800">
      {({ open }) => (
        <>
          <NavBar open={open} />
          <NavPanel />
        </>
      )}
    </Disclosure>
  );
}

function NavBar({ open }: { open: boolean }) {
  const session = useSession();
  const doAction = useDoAction();
  const current = useCurrentSessionNav();
  return (
    <div className="sm:px-6 lg:px-8">
      <div className="border-b border-gray-700">
        <div className="flex items-center justify-between h-16 px-4 sm:px-0">
          <div className="flex items-center">
            <div className="hidden md:block">
              <div className="flex items-baseline space-x-4">
                {session &&
                  sessionNav.map((item) => (
                    <Link
                      key={item.name}
                      href={'path' in item ? item.path : '#'}
                      onClick={(evt) => {
                        if ('action' in item) {
                          evt.preventDefault();
                          doAction(item.action);
                        }
                      }}
                      className={cls(
                        'path' in item && item.path === current
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                        'rounded-md px-3 py-2 text-sm font-medium',
                      )}
                      aria-current={
                        'path' in item && item.path === current
                          ? 'page'
                          : undefined
                      }
                    >
                      {item.name}
                    </Link>
                  ))}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center ml-4 md:ml-6">
              {session && <ProfileDropdown />}
            </div>
          </div>
          {!session && (
            <div className="flex gap-4">
              <Link
                href="/login"
                className="rounded-md bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-white/20"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-indigo-500 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Sign up
              </Link>
            </div>
          )}
          <div className="flex -mr-2 md:hidden">
            {/* Mobile menu button */}
            <Disclosure.Button className="relative inline-flex items-center justify-center p-2 text-gray-400 bg-gray-800 rounded-md hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              {open ? (
                <XMarkIcon className="block w-6 h-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block w-6 h-6" aria-hidden="true" />
              )}
            </Disclosure.Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileDropdown() {
  const session = useSession();
  const doAction = useDoAction();
  if (!session) return <></>;
  return (
    <Menu as="div" className="relative ml-3">
      <div>
        <Menu.Button className="relative flex items-center max-w-xs text-sm bg-gray-800 rounded-full focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
          <span className="absolute -inset-1.5" />
          <span className="sr-only">Open user menu</span>
          <UserImage width={32} user={session.user} />
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 w-48 py-1 mt-2 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <Menu.Item>
            <div className="flex justify-start px-4 pt-2 pb-2 mb-1 text-sm text-gray-500 align-middle border-b border-neutral-200">
              {session.user.email}
            </div>
          </Menu.Item>
          {userNav.map((item) => (
            <Menu.Item key={item.name}>
              {({ active }) => (
                <Link
                  href={'path' in item ? item.path : '#'}
                  onClick={(evt) => {
                    if ('action' in item) {
                      evt.preventDefault();
                      doAction(item.action);
                    }
                  }}
                  className={cls(
                    active ? 'bg-gray-100' : '',
                    'block px-4 py-2 text-sm text-gray-700',
                  )}
                >
                  {item.name}
                </Link>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

function NavPanel() {
  const router = useRouter();
  const session = useSession();
  const doAction = useDoAction();
  const current = useCurrentSessionNav();
  return (
    <Disclosure.Panel className="border-b border-gray-700 md:hidden">
      <div className="px-2 py-3 space-y-1 sm:px-3">
        {session &&
          sessionNav.map((item) => (
            <Disclosure.Button
              key={item.name}
              onClick={() => {
                if ('path' in item) {
                  router.push(item.path);
                } else {
                  doAction(item.action);
                }
              }}
              className={cls(
                'path' in item && current === item.path
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                'block rounded-md px-3 py-2 text-base font-medium',
              )}
              aria-current={
                'path' in item && current === item.path ? 'page' : undefined
              }
            >
              {item.name}
            </Disclosure.Button>
          ))}
      </div>
      <div className="pt-4 pb-3 border-t border-gray-700">
        {session && (
          <div className="flex items-center px-5">
            <div className="flex-shrink-0">
              <UserImage width={40} user={session?.user} />
            </div>
            <div className="ml-3">
              <div className="text-base font-medium leading-none text-white">
                {session.user.fullName}
              </div>
              <div className="text-sm font-medium leading-none text-gray-400">
                {session.user.email}
              </div>
            </div>
          </div>
        )}
        <div className="px-2 mt-3 space-y-1">
          {session &&
            userNav.map((item) => (
              <Disclosure.Button
                key={item.name}
                onClick={() => {
                  if ('path' in item) {
                    router.push(item.path);
                  } else {
                    doAction(item.action);
                  }
                }}
                className="block px-3 py-2 text-base font-medium text-gray-400 rounded-md hover:bg-gray-700 hover:text-white"
              >
                {item.name}
              </Disclosure.Button>
            ))}
        </div>
      </div>
    </Disclosure.Panel>
  );
}

const useDoAction = () => {
  const logoutMutation = useLogoutMutation();
  return (action: NavAction) => {
    switch (action) {
      case 'signOut':
        logoutMutation.mutate();
        break;
    }
  };
};

const useCurrentSessionNav = (): string | null => {
  const currentPathname = usePathname();
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    for (const option of sessionNav.slice().reverse()) {
      if ('path' in option && currentPathname?.startsWith(option.path)) {
        setCurrent(option.path);
        break;
      }
    }
  }, [currentPathname]);
  return current;
};
