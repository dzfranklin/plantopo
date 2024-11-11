'use client';

import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { formatElevation } from './format';
import UnitSettingsDialog from './UnitSettingsDialog';
import { useSettings } from '@/features/settings/useSettings';

export default function ElevationText({
  meters,
  unitSelector,
}: {
  meters: number;
  unitSelector?: boolean;
}) {
  const { units } = useSettings();
  const [value, unit] = formatElevation(meters, units);
  const [showSettings, setShowSettings] = useState(false);
  return (
    <span className="inline-flex items-end">
      <span>
        {value} {unit}
      </span>

      {unitSelector && (
        <>
          <button
            title="Change units"
            onClick={() => setShowSettings(true)}
            className="flex flex-col justify-baseline"
          >
            <ChevronDownIcon
              className="-mr-0.5 -ml-0.5 h-4 w-4 text-gray-500"
              aria-hidden="true"
            />
          </button>

          <UnitSettingsDialog
            isOpen={showSettings}
            close={() => setShowSettings(false)}
          />
        </>
      )}
    </span>
  );
}
