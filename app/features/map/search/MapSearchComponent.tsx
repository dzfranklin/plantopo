import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/16/solid';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { components } from '@/api/v1';
import { fetchClient } from '@/api/base';
import cls from '@/cls';
import { MapComponent } from '@/features/map/MapComponent';
import { feature, featureCollection } from '@turf/helpers';
import * as ml from 'maplibre-gl';
import { centroid } from '@turf/centroid';
import { bbox } from '@turf/bbox';

export interface MapSearchComponentProps {
  getBias?: () => { point: [number, number]; zoom: number } | void;
  setResults?: (_: SearchResult[] | null) => void;
  setSelected?: (_: SearchResult | null) => void;
}

export type SearchResult = components['schemas']['SearchResult'];

const submitDelay = 200;

// TODO: On initial search the first highlighted is wrong on the map

export function MapSearchComponent(props: MapSearchComponentProps) {
  const [results, _setResults] = useState<SearchResult[] | null>(null);
  const [selected, _setSelected] = useState<SearchResult | null>(null);

  const setSelected = (result: SearchResult | null) => {
    props?.setSelected?.(result);
    _setSelected(result);
  };

  const setResults = (results: SearchResult[] | null) => {
    _setResults(results ?? []);
    props.setResults?.(results ?? []);
  };

  return (
    <Combobox
      value={selected}
      onChange={setSelected}
      onClose={() => setResults([])}
      by={'id'}
    >
      {({ activeOption }) => (
        <div className="relative @container">
          <MapSearchInput {...props} setResults={setResults} />
          <MapSearchResults results={results} activeOption={activeOption} />
        </div>
      )}
    </Combobox>
  );
}

function MapSearchInput(props: MapSearchComponentProps) {
  const pendingSearch = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  return (
    <>
      <ComboboxInput
        className="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
        autoComplete="off"
        displayValue={(item: SearchResult | null) => item?.name ?? ''}
        onChange={(evt) => {
          const text = evt.target.value.trim();

          if (text.length < 3) {
            props.setResults?.([]);
            return;
          }

          const bias = props?.getBias?.();

          if (pendingSearch.current !== undefined) {
            clearTimeout(pendingSearch.current);
          }
          pendingSearch.current = setTimeout(async () => {
            const resp = await fetchClient.GET('/geosearch', {
              params: {
                query: {
                  text,
                  biasLng: bias?.point?.[0],
                  biasLat: bias?.point?.[1],
                  biasZoom: bias ? Math.round(bias.zoom) : undefined,
                  debug: true,
                },
              },
            });
            if (resp.data) {
              props.setResults?.(resp.data.results);
            } else if (resp.error) {
              console.error(resp.error);
            }
          }, submitDelay);
        }}
        onBlur={() => {
          if (pendingSearch.current !== undefined) {
            clearTimeout(pendingSearch.current);
          }
          props.setResults?.([]);
        }}
      />

      <ComboboxButton className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
        <MagnifyingGlassIcon
          className="h-5 w-5 text-gray-400"
          aria-hidden="true"
        />
      </ComboboxButton>
    </>
  );
}

export function MapSearchResults({
  results,
  activeOption,
}: {
  results: SearchResult[] | null;
  activeOption: SearchResult | null;
}) {
  if (!results || results.length === 0) return;

  return (
    <ComboboxOptions
      className={cls(
        'absolute mt-1 h-60 w-full overflow-auto',
        '@[400px]:grid grid-cols-2 grid-rows-1',
        'rounded-md bg-white text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm',
      )}
    >
      <div>
        {results?.map((result, i) => (
          <ResultEntryComponent key={i} result={result} />
        ))}
      </div>

      <div className="hidden @sm:block">
        <ResultsMapComponent results={results} activeOption={activeOption} />
      </div>
    </ComboboxOptions>
  );
}

function ResultEntryComponent({ result }: { result: SearchResult }) {
  return (
    <ComboboxOption
      value={result}
      className="group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-indigo-600 data-[focus]:text-white"
    >
      <span className="block truncate group-data-[selected]:font-semibold">
        {result.name}
      </span>

      <span className="absolute inset-y-0 right-0 hidden items-center pr-4 text-indigo-600 group-data-[selected]:flex group-data-[focus]:text-white">
        <CheckIcon className="h-5 w-5" aria-hidden="true" />
      </span>
    </ComboboxOption>
  );
}

function ResultsMapComponent({
  results,
  activeOption,
}: {
  results: SearchResult[];
  activeOption: SearchResult | null;
}) {
  const mapRef = useRef<ml.Map | null>(null);
  const prevMarkers = useRef<ml.Marker[]>([]);

  const setMap = useCallback(
    (
      map: ml.Map,
      results: SearchResult[],
      activeOption: SearchResult | null,
    ) => {
      // Reset map

      for (const m of prevMarkers.current) {
        m.remove();
      }

      // Add markers

      const newMarkers: ml.Marker[] = [];
      for (const r of results) {
        const isActive = r.id === activeOption?.id;
        const center = centroid(r.geometry).geometry.coordinates;
        const m = new ml.Marker({
          color: isActive ? 'rgb(59 130 246)' : 'rgb(156 163 175)',
        })
          .setLngLat([center[0]!, center[1]!])
          .addTo(map);
        newMarkers.push(m);
      }

      // Change view

      const animate = prevMarkers.current.length > 0;

      if (activeOption !== null) {
        const center = centroid(activeOption.geometry).geometry.coordinates;
        map.flyTo({
          center: [center[0]!, center[1]!],
          zoom: 7.5,
          animate,
        });
      } else if (results.length > 0) {
        const bounds = bbox(
          featureCollection(results.map((r) => feature(r.geometry))),
        );
        map.fitBounds([bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!], {
          minZoom: 7.5,
          padding: {
            top: 40,
            left: 40,
            right: 40,
            bottom: 80, // because the attribution will be open
          },
          animate,
        });
      }

      // Save state

      prevMarkers.current = newMarkers;
    },
    [],
  );

  useEffect(() => {
    mapRef.current && setMap(mapRef.current, results, activeOption);
  }, [results, activeOption, setMap]);

  return (
    <MapComponent
      initialBaseStyle="topo"
      interactive={false}
      onMap={(map) => {
        mapRef.current = map;
        setMap(map, results, activeOption);
        return () => {
          mapRef.current = null;
        };
      }}
    />
  );
}