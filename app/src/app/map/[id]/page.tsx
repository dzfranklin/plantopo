'use client';

import { SyncDriver } from '@/sync/SyncDriver';
import { useEffect, useMemo, useState } from 'react';
import FeatureSidebar from './FeatureSidebar';

export default function MapPage({ params }: { params: { id: string } }) {
  const id = Number.parseInt(params.id, 10);
  if (params.id.startsWith('0') || /[^\d]/.test(params.id) || isNaN(id)) {
    throw new Error('Invalid map id');
  }

  const driver = useMemo(() => new SyncDriver(id), [id]);
  useEffect(() => {
    driver.connect();
  }, [driver]);

  return (
    <div className="grid h-screen grid-cols-2 grid-rows-1 overflow-hidden">
      <FeatureSidebar driver={driver} />
      <div>Map {id}</div>
    </div>
  );
}
