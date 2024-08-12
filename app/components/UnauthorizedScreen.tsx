import { getUser } from '@workos-inc/authkit-nextjs';
import { Layout } from './Layout';

export default async function UnauthorizedScreen() {
  // if we aren't logged in then redirect
  await getUser({ ensureSignedIn: true });

  return (
    <Layout className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-4xl font-bold">Unauthorized</h1>
      <p className="text-lg">You are not authorized to view this page.</p>
    </Layout>
  );
}
