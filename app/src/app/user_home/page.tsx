'use client';

import Navbar from '@/generic/Navbar';
import { UserMapsManagerComponent } from './UserMapsManagerComponent';

export default function UserHomePage() {
  return (
    <div className="w-full h-full grid grid-rows-[min-content_minmax(0,1fr)] grid-cols-[auto] pb-6">
      <Navbar />
      <UserMapsManagerComponent />
    </div>
  );
}
