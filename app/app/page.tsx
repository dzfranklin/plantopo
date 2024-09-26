import { Layout } from '@/components/Layout';
import Link from 'next/link';

export default function Home() {
  return (
    <Layout>
      <p>TODO: Home</p>
      <Link href="/login?demo" className="link">
        Login to a demo account
      </Link>
    </Layout>
  );
}
