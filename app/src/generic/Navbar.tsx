import { useLogoutMutation } from '@/features/account/api/useLogoutMutation';
import { Button } from '@adobe/react-spectrum';
import Link from 'next/link';
import cls from './cls';
import { useCurrentUser } from '@/features/account/useCurrentUser';
import { User } from '@/features/account/api/User';

export default function Navbar() {
  const currentUser = useCurrentUser();
  return (
    <div
      className={cls(
        'mb-8 px-8 py-2 grid fit-content grid-cols-[200px_minmax(0,1fr)_200px]',
        'border-b border-b-neutral-300',
      )}
    >
      <h1 className="flex flex-col justify-center justify-self-start">
        <Link href="/" className="font-semibold">
          Plantopo
        </Link>
      </h1>

      <div className="flex items-center justify-end col-start-3 gap-4 justify-self-end">
        {currentUser ? (
          <LoggedInUserSection user={currentUser} />
        ) : (
          <LoggedOutUserSection />
        )}
      </div>
    </div>
  );
}

function LoggedInUserSection({ user }: { user: User }) {
  const logoutMutation = useLogoutMutation();
  return (
    <>
      <span className="min-w-fit">{user.name}</span>
      <div className="min-w-fit">
        <Button variant="secondary" onPress={() => logoutMutation.mutate()}>
          {logoutMutation.isLoading || logoutMutation.isSuccess
            ? 'Logging out...'
            : 'Log out'}
        </Button>
      </div>
    </>
  );
}

function LoggedOutUserSection() {
  return (
    <>
      <Button variant="primary" elementType="a" href="/account/login">
        Log in
      </Button>
      <Button variant="accent" elementType="a" href="/account/register">
        Sign up
      </Button>
    </>
  );
}
