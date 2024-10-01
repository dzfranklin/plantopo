import Link from 'next/link';
import { Layout } from '@/components/Layout';

const entries: { name: string; link: string; description?: string }[] = [
  {
    name: 'Geophotos',
    link: '/geophotos',
    description: 'View photos of the outdoors from around the world',
  },
  {
    name: 'Munro access',
    link: '/munro-access',
    description: 'Find Munros accessible via public transit in Scotland.',
  },
  {
    name: 'Visualize GPX points over time',
    link: '/tools/gpx-points-over-time',
  },
];

export default function Page() {
  return (
    <Layout pageTitle="Tools" inlineTitle={false}>
      <div className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:pt-32 lg:px-8 lg:py-40">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <h2 className="text-2xl font-bold leading-10 tracking-tight text-gray-900">
                Tools
              </h2>
            </div>
            <div className="mt-10 lg:col-span-7 lg:mt-0">
              <dl className="space-y-10">
                {entries.map((entry) => (
                  <div key={entry.name}>
                    <dt className="text-base font-semibold leading-7 text-gray-900 link">
                      <Link href={entry.link}>{entry.name}</Link>
                    </dt>
                    {entry.description && (
                      <dd className="mt-2 text-base leading-7 text-gray-600">
                        {entry.description}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
