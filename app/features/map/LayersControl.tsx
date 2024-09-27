import {
  BaseStyle,
  baseStyles,
  OverlayStyle,
  overlayStyles,
} from '@/features/map/style';
import { ReactNode, useMemo, useState } from 'react';
import { Dialog } from '@/components/dialog';
import { Button } from '@/components/button';
import cls from '@/cls';
import { BugAntIcon } from '@heroicons/react/16/solid';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import { Label } from '@headlessui/react';

const baseStylesByCountry = Object.values(baseStyles).reduce((acc, item) => {
  const existing = acc.get(item.country);
  if (existing) {
    existing.add(item);
  } else {
    acc.set(item.country, new Set([item]));
  }
  return acc;
}, new Map<string, Set<BaseStyle>>());

const baseStyleCountries = Array.from(baseStylesByCountry.keys()).filter(
  (country) => country !== 'Global',
);

const overlayStyleList = Object.values(overlayStyles).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export interface LayersControlProps {
  activeBase: BaseStyle;
  setActiveBase: (_: BaseStyle) => void;
  activeOverlays: OverlayStyle[];
  setActiveOverlays: (overlayStyles: OverlayStyle[]) => void;
  debugMenu?: ReactNode;
}

export function LayersControl(props: LayersControlProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <LayerButton
        preview={'/style-preview/landsat_60x60.png'}
        label="Layers"
        onClick={() => setExpanded(true)}
      />

      <LayersDialog
        {...props}
        isOpen={expanded}
        onClose={() => setExpanded(false)}
      />
    </>
  );
}

function LayersDialog({
  activeBase,
  setActiveBase,
  activeOverlays,
  setActiveOverlays,
  debugMenu,
  isOpen,
  onClose,
}: LayersControlProps & { isOpen: boolean; onClose: () => void }) {
  const [showDebugMenu, setShowDebugMenu] = useState(false);

  return (
    <Dialog open={isOpen} onClose={() => onClose()} className="relative">
      <div className="space-y-8">
        <div>
          <p className="font-semibold mb-4">Base layer</p>
          <ul className="space-y-4">
            <BaseStyleCountryGroup
              country={'Global'}
              baseStyle={activeBase}
              setBaseStyle={setActiveBase}
            />

            {baseStyleCountries.map((country) => (
              <BaseStyleCountryGroup
                key={country}
                country={country}
                baseStyle={activeBase}
                setBaseStyle={setActiveBase}
              />
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold mb-4">Overlays</p>
          <ul>
            {overlayStyleList.map((item) => (
              <li key={item.id}>
                <OverlayControl
                  item={item}
                  isActive={activeOverlays.some((v) => v.id === item.id)}
                  setActive={(value) => {
                    if (value) {
                      setActiveOverlays([...activeOverlays, item]);
                    } else {
                      setActiveOverlays(
                        activeOverlays.filter((v) => v.id !== item.id),
                      );
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        </div>

        {showDebugMenu && (
          <div>
            <p className="font-semibold mb-4">Debug menu</p>
            {debugMenu}
          </div>
        )}
      </div>

      <Dialog.Actions>
        <Button color="primary" onClick={() => onClose()}>
          Done
        </Button>
      </Dialog.Actions>

      <div
        className="absolute left-4 bottom-4"
        onClick={() => setShowDebugMenu((p) => !p)}
      >
        <span className="sr-only">toggle debug menu</span>
        <BugAntIcon width="16px" height="16px" />
      </div>
    </Dialog>
  );
}

function BaseStyleCountryGroup({
  country,
  baseStyle,
  setBaseStyle,
}: {
  country: string;
  baseStyle: BaseStyle;
  setBaseStyle: (_: BaseStyle) => void;
}) {
  const entries = useMemo(
    () =>
      Array.from(baseStylesByCountry.get(country) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [country],
  );

  if (entries.length === 0) return null;

  return (
    <div>
      <p className="text-sm mb-1">{country}</p>
      <ul className="grid grid-cols-[repeat(auto-fit,63px)] gap-x-1 gap-y-2 -ml-[3px]">
        {entries.map((entry) => (
          <LayerButton
            key={entry.id}
            preview={entry.preview}
            label={entry.name}
            selected={entry.id === baseStyle.id}
            onClick={() => setBaseStyle(entry)}
          />
        ))}
      </ul>
    </div>
  );
}

function LayerButton({
  preview,
  label,
  selected,
  onClick,
}: {
  preview: string;
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cls(
        'relative h-[63px] w-[63px] text-[11px] rounded-lg bg-cover',
        selected === undefined && 'border-white border-[1.5px]',
        selected === true && 'border-blue-600 border-[3px]',
        selected === false && 'border-white border-[3px]',
      )}
      style={{
        backgroundImage: `
            linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0) 30%,
              rgba(0, 0, 0, 0.9) 100%
            ),
            url(${encodeURI(preview)})`,
      }}
    >
      <div className="absolute left-1 right-1 bottom-1 text-gray-100 text-center truncate">
        {label}
      </div>
    </button>
  );
}

function OverlayControl({
  item,
  isActive,
  setActive,
}: {
  item: OverlayStyle;
  isActive: boolean;
  setActive: (value: boolean) => void;
}) {
  return (
    <CheckboxField>
      <Checkbox checked={isActive} onChange={() => setActive(!isActive)} />
      <Label>{item.name}</Label>
    </CheckboxField>
  );
}
