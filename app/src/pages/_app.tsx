import { RootLayout } from '@/app/layout';

export default function MyApp({
  Component,
  pageProps,
}: {
  Component: React.ComponentType;
  pageProps: any;
}) {
  return (
    <RootLayout>
      <Component {...pageProps} />
    </RootLayout>
  );
}
