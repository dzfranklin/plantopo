import { MapComponent } from '@/features/map/MapComponent';
import { Dispatch, ReactNode, SetStateAction } from 'react';
import { Select } from '@/components/select';
import { clamp } from '@/math';
import { bboxIntersects } from '@/geo';
import { Label } from '@/components/fieldset';
import { Checkbox, CheckboxField } from '@/components/checkbox';

interface Options {
  areaOfInterest?: [number, number, number, number];
  greatBritainMap?: 'osExplorer' | 'osLandranger';
  permitConstructedEnvironment?: boolean;
}

const gbBounds = [-8.088341, 49.582226, 2.614746, 62.148826] as const;

export function ContourGuessrPicker({
  options,
  setOptions,
}: {
  options: Options;
  setOptions: Dispatch<SetStateAction<Options>>;
}) {
  return (
    <div className="space-y-8 w-full max-w-xl">
      <PickerSection
        label="Area of interest"
        help="Zoom so that the part of the world you are interested in is visible."
      >
        <div className="aspect-[4/3]">
          <MapComponent
            initialCamera={{ lng: 0, lat: 0, zoom: -1 }}
            onMoveEnd={(m) => {
              const b = m.getBounds().toArray();
              const aoi: Options['areaOfInterest'] = [
                clamp(Math.min(b[0]![0], b[1]![0]), -180, 180),
                clamp(Math.min(b[0]![1], b[1]![1]), -90, 90),
                clamp(Math.max(b[0]![0], b[1]![0]), -180, 180),
                clamp(Math.max(b[0]![1], b[1]![1]), -90, 90),
              ];
              if (
                aoi[0] === -180 &&
                aoi[1] <= -80 &&
                aoi[2] === 180 &&
                aoi[3] >= 80
              ) {
                setOptions((p) => ({
                  ...p,
                  areaOfInterest: undefined,
                  greatBritainMap: undefined,
                }));
              } else {
                setOptions((p) => ({ ...p, areaOfInterest: aoi }));
              }
            }}
          />
        </div>
      </PickerSection>

      {options.areaOfInterest &&
        bboxIntersects(options.areaOfInterest, gbBounds) && (
          <GBMapSelect options={options} setOptions={setOptions} />
        )}

      <PickerSection label="Filters">
        <CheckboxField>
          <Checkbox
            checked={!!options.permitConstructedEnvironment}
            onChange={(v) =>
              setOptions((p) => ({
                ...p,
                permitConstructedEnvironment: v ? true : undefined,
              }))
            }
          />
          <Label>Permit constructed environment (e.g. field boundaries)</Label>
        </CheckboxField>
      </PickerSection>
    </div>
  );
}

function PickerSection({
  label,
  help,
  children,
}: {
  label: ReactNode;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="font-semibold">{label}</p>
      {help !== undefined && <p className="text-gray-700 text-sm">{help}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function GBMapSelect({
  options,
  setOptions,
}: {
  options: Options;
  setOptions: Dispatch<SetStateAction<Options>>;
}) {
  return (
    <PickerSection label="Great Britain map">
      <Select
        value={options.greatBritainMap}
        onChange={(evt) => {
          let value: Options['greatBritainMap'];
          switch (evt.target.value) {
            case 'osExplorer':
              value = 'osExplorer';
              break;
            case 'osLandranger':
              value = 'osLandranger';
              break;
          }
          setOptions((p) => ({
            ...p,
            greatBritainMap: value,
          }));
        }}
      >
        <option value="default">Default</option>
        <option value="osExplorer">OS Explorer</option>
        <option value="osLandranger">OS Landranger</option>
      </Select>
    </PickerSection>
  );
}
