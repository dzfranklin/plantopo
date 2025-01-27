import { forwardRef } from 'react';
import { PageTitle } from '@/components/PageTitle';
import { StackedLayout } from '@/components/stacked-layout';
import Footer from './Footer';
import cls from '@/cls';
import { PNavbar, PSidebar } from '@/components/Layout/Nav';

export const Layout = forwardRef(
  (
    {
      children,
      pageTitle,
      pageActions,
      wide,
      inlineTitle,
      fullBleed,
      ...props
    }: {
      children?: React.ReactNode;
      pageTitle?: string;
      inlineTitle?: boolean;
      fullBleed?: boolean;
      pageActions?: React.ReactNode;
      wide?: boolean;
    } & React.ComponentPropsWithoutRef<'div'>,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    return (
      <div className="grid grid-cols-1 grid-rows-[minmax(0,1fr)_min-content] min-h-svh">
        <StackedLayout
          wide={wide}
          fullBleed={fullBleed}
          navbar={<PNavbar />}
          sidebar={<PSidebar />}
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
        {!fullBleed && <Footer />}
      </div>
    );
  },
);
Layout.displayName = 'Layout';
