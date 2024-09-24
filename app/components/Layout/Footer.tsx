import Link from 'next/link';

const navigation = {
  main: [
    { name: 'Status', href: 'https://status.plantopo.com' },
    { name: 'Source', href: 'https://github.com/dzfranklin/plantopo' },
    { name: 'Credits', href: '/credits' },
  ],
};

export default function Example() {
  return (
    <footer className="mx-auto w-full max-w-7xl overflow-hidden px-6 py-6 lg:px-8">
      <nav
        className="-mb-6 flex space-x-6 justify-center sm:space-x-12"
        aria-label="Footer"
      >
        {navigation.main.map((item) => (
          <div key={item.name} className="pb-6">
            <Link
              href={item.href}
              className="text-sm leading-6 text-gray-600 hover:text-gray-900"
            >
              {item.name}
            </Link>
          </div>
        ))}
        <div
          className="text-xs leading-6 text-gray-600 hover:text-gray-900 truncate"
          title="by Daniel Franklin (daniel@plantopo.com)"
        >
          by Daniel Franklin (daniel@plantopo.com)
        </div>
      </nav>
    </footer>
  );
}
