import '../app/globals.css';
import { ReactNode } from 'react';
import Providers from '../app/providers';

export function Layout({ children }: { children: ReactNode }) {
  return <Providers forceDebugModeAllowed={true}>{children}</Providers>;
}
