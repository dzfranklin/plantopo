import { InspectFeature } from '../InspectFeature';
import type { OverlayStyle } from './OverlayStyle';
import { useEffect, useMemo, useState } from 'react';
import { Button, IconButton } from '@/components/button';
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/16/solid';
import { z } from 'zod';
import { Dialog } from '@/components/dialog';
import cls from '@/cls';

export function PaperMapsInspect({ f }: { f: InspectFeature }) {
  const images = useMemo(() => {
    let list: string[] = [];
    if ('images' in f.properties) {
      const parse = z
        .array(z.string().url())
        .safeParse(JSON.parse(f.properties.images));
      if (parse.success) {
        list = parse.data;
      } else {
        console.error('failed to parse f.properties.images', parse.error);
      }
    }
    if (list.length === 0 && 'thumbnail' in f.properties) {
      const parse = z.string().url().safeParse(f.properties.thumbnail);
      if (parse.success) {
        list = [parse.data];
      } else {
        console.error('failed to parse f.properties.thumbnail', parse.error);
      }
    }
    return list;
  }, [f]);

  const [activeImageI, setActiveImagesI] = useState<number | null>(null);

  useEffect(() => {
    setActiveImagesI(images.length > 0 ? 0 : null);
  }, [images]);

  const [expanded, setExpanded] = useState(false);

  const contents = (
    <div className="w-full">
      <div className={cls(expanded ? 'mb-6' : 'mb-2')}>
        <div
          className={cls(
            'flex items-center gap-1.5 text-sm h-[1.25rem]',
            expanded ? 'mb-2' : 'mb-0.5',
          )}
        >
          {'icon' in f.properties && (
            <img
              src={f.properties.icon}
              className="self-stretch my-1"
              alt="map icon"
            />
          )}

          <a
            href={f.properties.url}
            className="link font-medium truncate"
            title={f.properties.title}
            target="_blank"
          >
            {f.properties.short_title || f.properties.title || 'Untitled'}
          </a>

          {'color' in f.properties && (
            <span
              className="inline-block w-2 my-[0.22rem] self-stretch font-medium"
              style={{ backgroundColor: f.properties.color }}
            />
          )}
        </div>

        <div className="text-xs">
          {'title' in f.properties && <span>{f.properties.title}</span>}
          {'title' in f.properties && 'publisher' in f.properties && ' | '}
          {'publisher' in f.properties && <span>{f.properties.publisher}</span>}
        </div>
      </div>

      {activeImageI !== null && (
        <div className="w-full flex">
          <div>
            <img
              src={images[activeImageI]!}
              className={cls('max-w-full', !expanded && 'max-h-[210px]')}
              alt=""
            />
          </div>

          <div className="flex flex-col justify-end ml-1">
            <IconButton
              onClick={() => setExpanded(!expanded)}
              small
              plain
              aria-label="Toggle expanded"
              className="mb-auto"
            >
              {expanded ? (
                <ArrowsPointingInIcon className="h-4 w-4" />
              ) : (
                <ArrowsPointingOutIcon className="h-4 w-4" />
              )}
            </IconButton>

            {images.length > 1 && (
              <>
                <IconButton
                  onClick={() => setActiveImagesI(activeImageI - 1)}
                  disabled={activeImageI == 0}
                  plain
                  small
                  aria-label="Previous image"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  onClick={() => setActiveImagesI(activeImageI + 1)}
                  disabled={activeImageI == images.length - 1}
                  aria-label="Next image"
                  small
                  plain
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </IconButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (expanded) {
    return (
      <Dialog open={expanded} onClose={() => setExpanded(false)}>
        <Dialog.Body>{contents}</Dialog.Body>
        <Dialog.Actions>
          <Button onClick={() => setExpanded(false)}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    );
  } else {
    return contents;
  }
}

export const paperMapsOverlay: OverlayStyle = {
  id: 'paper-maps',
  name: 'Paper Maps',
  details:
    'My work-in-progress database of paper maps. Contribute at <a href="https://github.com/dzfranklin/paper-maps" target="_blank">github.com/dzfranklin/paper-maps</a>.',
  inspect: (f) => <PaperMapsInspect f={f} />,
  sources: {
    default: {
      type: 'vector',
      url: 'pmtiles://https://plantopo-storage.b-cdn.net/paper-maps/paper_maps.pmtiles',
    },
  },
  layers: [
    {
      id: 'outline',
      type: 'line',
      source: 'default',
      'source-layer': 'default',
      minzoom: 4,
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#424242'],
        'line-width': 1.5,
        'line-opacity': 0.8,
      },
    },
    {
      id: 'fill',
      type: 'fill',
      source: 'default',
      'source-layer': 'default',
      minzoom: 5,
      layout: {},
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], '#424242'],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.3,
          0.1,
        ],
      },
    },
    {
      id: 'label',
      type: 'symbol',
      source: 'default',
      'source-layer': 'default',
      layout: {
        // prettier-ignore
        'icon-offset': ['step', ['zoom'],
          ['literal', [0, 0]],
          7, ['literal', [0, -0.2]]],
        'icon-image': ['get', 'icon'],
        'icon-allow-overlap': ['step', ['zoom'], false, 6, true],
        'icon-anchor': ['step', ['zoom'], 'center', 7, 'bottom'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 9, 0.5],

        'text-offset': [0, 0.2],
        // prettier-ignore
        'text-field': [
          'step', ['zoom'],
          '',
          7, ['get', 'short_title'],
          9, ['get', 'title'],
        ],
        'text-allow-overlap': true,
        'text-size': 14,
        'text-anchor': 'top',
      },
      paint: {
        'text-color': ['coalesce', ['get', 'color'], '#212121'],
        'text-halo-width': 1.4,
        'text-halo-color': '#fafafa',
      },
    },
  ],
};
