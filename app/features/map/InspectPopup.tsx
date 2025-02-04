import { JSX, useState } from 'react';
import { IconButton } from '@/components/button';
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
} from '@heroicons/react/16/solid';

export interface InspectionPopupData {
  sourceName: string;
  body: JSX.Element;
}

export function inspectPopupContents(inspections: InspectionPopupData[]) {
  return <InspectPopupContents inspections={inspections} />;
}

export function InspectPopupContents({
  inspections,
}: {
  inspections: InspectionPopupData[];
}) {
  const [activeI, setActiveII] = useState(0);
  if (inspections.length === 0) return null;
  const active = inspections[activeI]!;
  return (
    <div className="h-full max-h-full w-full max-w-full flex flex-col">
      <h3 className="mb-1 -mt-2 mr-2 flex items-center">
        <span className="grow font-semibold uppercase text-xs">
          {active.sourceName}
        </span>

        {inspections.length > 1 && (
          <span>
            <IconButton
              plain
              disabled={activeI == 0}
              onClick={() => setActiveII(activeI - 1)}
            >
              <ArrowLeftCircleIcon className="h-4 w-4" />
            </IconButton>

            <IconButton
              plain
              disabled={activeI == inspections.length - 1}
              onClick={() => setActiveII(activeI + 1)}
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
            </IconButton>
          </span>
        )}
      </h3>
      <div className="grow overflow-auto">{active.body}</div>
    </div>
  );
}
