'use client';

import { GeophotosMap } from '@/features/geophotos/GeophotosMap';
import { useState } from 'react';
import cls from '@/cls';
import { GeophotosPaneLoader } from '@/features/geophotos/GeophotosPaneLoader';

export function GeophotosComponent() {
  const [selected, setSelected] = useState<number[]>([]);

  return (
    <div className="h-full w-full relative">
      <div className="absolute inset-0">
        <GeophotosMap onSelect={setSelected} />
      </div>
      <div
        className={cls(
          'absolute left-4 right-4 bottom-6 h-[200px] transition-opacity pointer-events-none',
          selected.length > 0 ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="inline-block max-w-full bg-gray-200 bg-opacity-50 overflow-clip pointer-events-auto">
          <GeophotosPaneLoader photos={selected} />
        </div>
      </div>
    </div>
  );
}
