'use client';

import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { formatDistance } from './format';
import UnitSettingsDialog from './UnitSettingsDialog';
import { useSettings } from '@/features/settings/useSettings';

export default function DistanceText({ meters }: { meters: number }) {
  const { units } = useSettings();
  const [value, unit] = formatDistance(meters, units);
  const [showSettings, setShowSettings] = useState(false);
  return (
    <span className="inline-flex items-end">
      <span>
        {value} {unit}
      </span>
      <button title="Change units" onClick={() => setShowSettings(true)}>
        <ChevronDownIcon
          className="-mr-1 mb-0.5 h-5 w-5 text-gray-400"
          aria-hidden="true"
        />
      </button>

      <UnitSettingsDialog
        isOpen={showSettings}
        close={() => setShowSettings(false)}
      />
    </span>
  );
}
