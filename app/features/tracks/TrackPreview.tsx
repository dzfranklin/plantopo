'use client';

import { Feature, LineString } from 'geojson';
import { simplify } from '@turf/simplify';
import { encode as encodePolyline } from '@mapbox/polyline';
import { useEffect, useMemo, useState } from 'react';
import { MAPBOX_TOKEN } from '@/env';

export default function TrackPreview(
  props: {
    width?: number;
    height?: number;
    padding?: number;
    geojson: Feature<LineString>;
  } & JSX.IntrinsicElements['img'],
) {
  const padding = props.padding || 20;
  const width = props.width || 427;
  const height = props.height || 240;
  const geojson = props.geojson;

  const [highRes, setHighRes] = useState(false);
  useEffect(() => {
    // use a media query to detect high-res screens
    const mql = window.matchMedia('screen and (min-resolution: 2dppx)');
    const listener = () => setHighRes(mql.matches);
    mql.addEventListener('change', listener);
    setHighRes(mql.matches);
    return () => mql.removeEventListener('change', listener);
  }, []);

  const url = useMemo(
    () => computeURL(geojson, width, height, padding, highRes),
    [geojson, width, height, padding, highRes],
  );

  return (
    <img
      {...{ ...props, geojson: undefined, padding: undefined, src: url }}
      alt={props.alt}
    />
  );
}

const styleUsername = 'dzfranklin';
const styleId = 'clxlno49r00er01qq3ppk4wwo';
const maxURLLength = 8000;

function computeURL(
  geojson: Feature<LineString>,
  width: number,
  height: number,
  padding: number,
  highRes: boolean,
): string {
  let tolerance = 0.0001;
  const compute = () =>
    computeURLWithTolerance(
      tolerance,
      geojson,
      width,
      height,
      padding,
      highRes,
    );
  let url = compute();
  while (url.length > maxURLLength) {
    tolerance *= 2;
    url = compute();
  }
  return url;
}

function computeURLWithTolerance(
  tolerance: number,
  geojson: Feature<LineString>,
  width: number,
  height: number,
  padding: number,
  highRes: boolean,
): string {
  const coords = simplify(geojson, { tolerance }).geometry.coordinates.map(
    ([a, b]) => [b, a],
  );
  const polyline = encodeURIComponent(
    encodePolyline(coords as [number, number][]),
  );
  return `https://api.mapbox.com/styles/v1/${styleUsername}/${styleId}/static/path-4+3761e2(${polyline})/auto/${width}x${height}${
    highRes ? '@2x' : ''
  }?padding=${padding}&access_token=${MAPBOX_TOKEN}`;
}
