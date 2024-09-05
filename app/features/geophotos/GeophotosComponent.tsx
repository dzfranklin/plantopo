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
          'absolute left-4 right-4 bottom-4 h-[200px] rounded-lg bg-white overflow-clip transition-opacity',
          selected.length > 0 ? 'opacity-100' : 'opacity-0',
        )}
      >
        <GeophotosPaneLoader photos={selected} />
      </div>
    </div>
  );
}
