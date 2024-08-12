'use client';

import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { useUnitSettings } from './useUnitSettings';
import { formatDistance } from './format';
import UnitSettingsDialog from './UnitSettingsDialog';

export default function DistanceText({ meters }: { meters: number }) {
  const [settings] = useUnitSettings();
  const [value, unit] = formatDistance(meters, settings.distance);
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
