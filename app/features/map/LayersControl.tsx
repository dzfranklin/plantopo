import {
  BaseStyle,
  baseStyles,
  DynamicOverlayStyle,
  OverlayStyle,
  overlayStyles,
  StyleVariables,
  StyleVariableSpec,
} from '@/features/map/style';
import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import cls from '@/cls';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import { Select } from '@/components/select';
import { useDebugMode } from '@/hooks/debugMode';
import { Field, Label } from '@/components/fieldset';
import * as ml from 'maplibre-gl';
import { applyVariablesToSource } from '@/features/map/MapManager';
import { PMTiles } from 'pmtiles';
import { useMapManager } from '@/features/map/useMap';
import Skeleton from '@/components/Skeleton';
import { useQuery } from '@tanstack/react-query';
import InlineAlert from '@/components/InlineAlert';
import { ChevronDownIcon } from '@heroicons/react/16/solid';
import { IconButton } from '@/components/button';

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
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeBase: BaseStyle;
  setActiveBase: (_: BaseStyle) => void;
  activeOverlays: (OverlayStyle | DynamicOverlayStyle)[];
  setActiveOverlays: (
    overlayStyles: (OverlayStyle | DynamicOverlayStyle)[],
  ) => void;
  variables: StyleVariables;
  setVariables: (variables: StyleVariables) => void;
  debugMenu?: ReactNode;
}

export interface LayersControlButtonProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function LayersControlButton(props: LayersControlButtonProps) {
  return (
    <LayerButton
      preview={'/style-preview/landsat_60x60.png'}
      label="Layers"
      onClick={() => props.setIsOpen(!props.isOpen)}
    />
  );
}

export function LayersControl({
  activeBase,
  setActiveBase,
  activeOverlays,
  setActiveOverlays,
  variables,
  setVariables,
  debugMenu,
  isOpen,
  setIsOpen,
}: LayersControlProps) {
  const debugMode = useDebugMode();

  if (!isOpen) return;

  return (
    <div className="z-10 absolute top-[10px] left-[10px] bottom-[10px] w-[calc(100%-20px)] md:max-w-96">
      <div className="relative h-full max-h-full rounded bg-white p-4 overflow-y-auto">
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
                    variables={variables.overlay?.[item.id]}
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
      </div>

      <div className="absolute top-1 right-1">
        <IconButton plain={true} onClick={() => setIsOpen(false)}>
          <ChevronDownIcon className="h-5" />
        </IconButton>
      </div>
    </div>
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
  item: OverlayStyle | DynamicOverlayStyle;
  isActive: boolean;
  setActive: (value: boolean) => void;
  variables: Record<string, string> | undefined;
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
        <ActiveOverlayDetails
          item={item}
          variables={variables}
          setVariables={setVariables}
        />
      )}
    </div>
  );
}

function ActiveOverlayDetails({
  item: maybeDynamicItem,
  variables,
  setVariables,
}: {
  item: OverlayStyle | DynamicOverlayStyle;
  variables: Record<string, string> | undefined;
  setVariables: (_: Record<string, string>) => void;
}) {
  const manager = useMapManager();
  const [item, setItem] = useState<OverlayStyle | null>(null);
  useEffect(() => {
    let cancelled = false;
    if ('dynamic' in maybeDynamicItem) {
      manager.resolveDynamicOverlay(maybeDynamicItem).then((v) => {
        if (!cancelled) setItem(v);
      });
    } else {
      setItem(maybeDynamicItem);
    }
    return () => {
      cancelled = true;
      setItem(null);
    };
  }, [maybeDynamicItem, manager]);

  if (!item) return null;

  return (
    <div className="ml-8 mt-2 mb-4 flex flex-col gap-y-2 text-sm text-slate-700">
      {item.legendURL !== undefined && <LayerLegend url={item.legendURL} />}

      {item.details !== undefined && (
        <p
          className="whitespace-pre-line inline-prose"
          dangerouslySetInnerHTML={{ __html: item.details }}
        />
      )}

      <LayerVariablesControl
        spec={item.variables}
        values={variables}
        setValues={setVariables}
      />

      <div>
        <OverlayLayerAttributionControl item={item} variables={variables} />

        <p className="text-xs mt-1">{item.versionMessage}</p>
      </div>
    </div>
  );
}

function LayerVariablesControl({
  spec,
  values,
  setValues,
}: {
  spec: Record<string, StyleVariableSpec> | undefined;
  values: Record<string, string> | undefined;
  setValues: (_: Record<string, string>) => void;
}) {
  if (!spec || Object.keys(spec).length === 0) return null;

  return (
    <div className="mb-1">
      {Object.entries(spec)
        .sort(([_aID, { label: aName }], [_bID, { label: bName }]) =>
          aName.localeCompare(bName),
        )
        .map(([id, spec]) => (
          <VariableControl
            key={id}
            spec={spec}
            value={values?.[id] ?? spec.options[0]?.value}
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
  value: string | undefined;
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

function OverlayLayerAttributionControl({
  item,
  variables,
}: {
  item: OverlayStyle;
  variables: Record<string, string> | undefined;
}) {
  const [attributions, setAttributions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setAttributions([]);
    setIsLoading(true);
    setFailedCount(0);

    if (!item.sources) {
      setIsLoading(false);
      return;
    }

    Promise.all(
      Object.entries(item.sources).map(([id, s]) =>
        resolveSourceAttribution(s, item.variables, variables).then(
          (value) => ({ id, value }),
          (error) => ({ id, error }),
        ),
      ),
    ).then((entries) => {
      let failures = 0;
      const values: string[] = [];

      for (const entry of entries) {
        if ('error' in entry) {
          console.warn('failed to fetch attribution', entry.id, entry.error);
          failures++;
        } else if (entry.value !== undefined && entry.value.trim() !== '') {
          values.push(entry.value);
        }
      }

      if (!cancelled) {
        setIsLoading(false);
        setFailedCount(failures);
        setAttributions(values);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [item, variables]);

  if (isLoading) {
    return 'Credit: loading...';
  } else if (attributions.length === 0 && failedCount === 0) {
    return null;
  } else {
    return (
      <p className="inline-prose">
        {'Credit: '}
        {attributions.map((v, i) => (
          <Fragment key={i}>
            <span dangerouslySetInnerHTML={{ __html: v }} />
            {i < attributions.length - 2 && ', '}
            {i === attributions.length - 2 && ', and'}
          </Fragment>
        ))}
        {failedCount > 0 && (
          <span>(failed to load attribution for {failedCount} sources)</span>
        )}
      </p>
    );
  }
}

async function resolveSourceAttribution(
  source: ml.SourceSpecification,
  variableSpec: Record<string, StyleVariableSpec> | undefined,
  variables: Record<string, string> | undefined,
): Promise<string | undefined> {
  if ('attribution' in source && typeof source.attribution === 'string') {
    if (source.attribution.trim() === '') {
      return undefined;
    } else {
      return source.attribution;
    }
  }

  if (variableSpec) {
    source = applyVariablesToSource(source, variableSpec, variables);
  }

  if ('url' in source && typeof source.url === 'string') {
    if (source.url.startsWith('pmtiles://')) {
      const url = source.url.substring(10);
      const pm = new PMTiles(url);
      const data = (await pm.getTileJson(url)) as Record<string, unknown>;
      if ('attribution' in data && typeof data.attribution === 'string') {
        return data.attribution;
      }
    } else {
      const resp = await fetch(source.url);
      if (resp.status < 200 || resp.status >= 300) {
        throw new Error(
          `failed to fetch ${source.url}: got status ${resp.status}`,
        );
      }

      const data = (await resp.json()) as ml.SourceSpecification;
      if ('attribution' in data && typeof data.attribution === 'string') {
        return data.attribution;
      }
    }
  }

  return undefined;
}

function LayerLegend({ url }: { url: string }) {
  const query = useQuery({
    queryKey: ['LayerLegend', url],
    queryFn: (context) =>
      fetch(url, { signal: context.signal }).then((r) => r.text()),
    staleTime: Infinity,
  });

  if (query.error) {
    return (
      <InlineAlert variant="error">Error: failed to load legend</InlineAlert>
    );
  }

  return (
    <div className="p-1 text-xs h-full min-h-5 max-h-32 overflow-y-auto">
      {query.data ? (
        <div
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: query.data }}
        />
      ) : (
        <Skeleton height="20px" width="100%" inline />
      )}
    </div>
  );
}
