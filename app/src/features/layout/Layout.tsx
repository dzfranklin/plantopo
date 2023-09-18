import { forwardRef } from 'react';
import Nav from './Nav';
import { PageTitle } from '@/generic/PageTitle';

export const Layout = forwardRef(
  (
    {
      children,
      pageTitle,
      ...props
    }: {
      children?: React.ReactNode;
      pageTitle?: string;
    } & React.ComponentPropsWithoutRef<'div'>,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    return (
      <div className="min-h-screen bg-gray-100">
        {pageTitle && <PageTitle title={pageTitle} />}
        <div className="pb-32 bg-gray-800">
          <Nav />
          <header className="py-10">
            <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                {pageTitle}
              </h1>
            </div>
          </header>
        </div>
        <main className="-mt-32">
          <div className="px-4 pb-12 mx-auto max-w-7xl sm:px-6 lg:px-8">
            <div className="px-5 py-10 bg-white rounded-lg shadow sm:px-6 min-h-[24rem]">
              <div {...props} ref={ref}>
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  },
);
Layout.displayName = 'Layout';
