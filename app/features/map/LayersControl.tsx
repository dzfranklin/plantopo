import {
  BaseStyle,
  baseStyles,
  OverlayStyle,
  overlayStyles,
  StyleVariables,
  StyleVariableSpec,
} from '@/features/map/style';
import { ReactNode, useMemo, useState } from 'react';
import { Dialog } from '@/components/dialog';
import { Button } from '@/components/button';
import cls from '@/cls';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import { Select } from '@/components/select';
import { useDebugMode } from '@/hooks/debugMode';
import { Field, Label } from '@/components/fieldset';
import { useQuery } from '@tanstack/react-query';

const baseStylesByRegion = Object.values(baseStyles).reduce((acc, item) => {
  const region = item.region ?? 'Global';
  const existing = acc.get(region);
  if (existing) {
    existing.add(item);
  } else {
    acc.set(region, new Set([item]));
  }
  return acc;
}, new Map<string, Set<BaseStyle>>());

const baseStyleRegions = Array.from(baseStylesByRegion.keys()).filter(
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
  variables: StyleVariables;
  setVariables: (variables: StyleVariables) => void;
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
  variables,
  setVariables,
  debugMenu,
  isOpen,
  onClose,
}: LayersControlProps & { isOpen: boolean; onClose: () => void }) {
  const debugMode = useDebugMode();

  return (
    <Dialog
      open={isOpen}
      onClose={() => onClose()}
      className="relative"
      size="xl"
    >
      <div className="space-y-8">
        <div>
          <p className="font-semibold mb-4">Base layer</p>
          <ul className="space-y-4">
            <BaseStyleRegionGroup
              region={'Global'}
              baseStyle={activeBase}
              setBaseStyle={setActiveBase}
            />

            {baseStyleRegions.map((region) => (
              <BaseStyleRegionGroup
                key={region}
                region={region}
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
                  variables={variables.overlay?.[item.id] ?? {}}
                  setVariables={(v) =>
                    setVariables({
                      ...variables,
                      overlay: { ...variables.overlay, [item.id]: v },
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </div>

        {debugMode && (
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
    </Dialog>
  );
}

function BaseStyleRegionGroup({
  region,
  baseStyle,
  setBaseStyle,
}: {
  region: string;
  baseStyle: BaseStyle;
  setBaseStyle: (_: BaseStyle) => void;
}) {
  const entries = useMemo(
    () =>
      Array.from(baseStylesByRegion.get(region) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [region],
  );

  if (entries.length === 0) return null;

  return (
    <div>
      <p className="text-sm mb-1">{region}</p>
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
        'relative h-[63px] w-[63px] text-[11px] rounded-lg bg-cover select-none',
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
  variables,
  setVariables,
}: {
  item: OverlayStyle;
  isActive: boolean;
  setActive: (value: boolean) => void;
  variables: Record<string, string>;
  setVariables: (_: Record<string, string>) => void;
}) {
  return (
    <div className="mb-1">
      <CheckboxField>
        <Checkbox checked={isActive} onChange={() => setActive(!isActive)} />
        <Label>
          <span className="font-medium">{item.name}</span>
          {item.region !== undefined && (
            <div className="inline-block py-1 px-2 mx-1 bg-gray-300 rounded-md text-xs tracking-wide">
              {item.region}
            </div>
          )}
        </Label>
      </CheckboxField>

      {isActive && (
        <div className="ml-8 mt-1 mb-4 flex flex-col gap-y-3 text-sm text-slate-700">
          {item.details !== undefined && (
            <p
              className="whitespace-pre-line inline-prose"
              dangerouslySetInnerHTML={{ __html: item.details }}
            />
          )}

          <VariablesControl
            spec={item.variables}
            values={variables}
            setValues={setVariables}
          />

          <VersionMessage url={item.versionMessageURL} />
        </div>
      )}
    </div>
  );
}

function VersionMessage({ url }: { url: string | undefined }) {
  const versionMessageQuery = useQuery({
    queryKey: ['VersionMessage', url],
    enabled: url !== undefined,
    queryFn: async () => {
      if (!url) return;
      const resp = await fetch(url);
      if (resp.status !== 200) throw new Error('status ' + resp.status);
      return await resp.text();
    },
  });

  if (versionMessageQuery.data) {
    return <p className="text-xs mt-1">{versionMessageQuery.data}</p>;
  } else {
    return null;
  }
}

function VariablesControl({
  spec,
  values,
  setValues,
}: {
  spec: Record<string, StyleVariableSpec> | undefined;
  values: Record<string, string>;
  setValues: (_: Record<string, string>) => void;
}) {
  if (!spec || Object.keys(spec).length === 0) return null;

  return (
    <div>
      {Object.entries(spec)
        .sort(([_aID, { label: aName }], [_bID, { label: bName }]) =>
          aName.localeCompare(bName),
        )
        .map(([id, spec]) => (
          <VariableControl
            key={id}
            spec={spec}
            value={values[id] ?? spec.defaultValue}
            setValue={(v) => setValues({ ...values, [id]: v })}
          />
        ))}
    </div>
  );
}

function VariableControl({
  spec,
  value,
  setValue,
}: {
  spec: StyleVariableSpec;
  value: string;
  setValue: (value: string) => void;
}) {
  switch (spec.type) {
    case 'select':
      return (
        <Field className="flex flex-row items-baseline gap-4">
          <Label>{spec.label}</Label>
          <Select value={value} onChange={(e) => setValue(e.target.value)}>
            {spec.options.map((s) => (
              <option key={s.value} value={s.value}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      );
  }
}
