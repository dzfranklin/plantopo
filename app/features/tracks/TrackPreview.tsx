'use client';

import 'leaflet/dist/leaflet.css';
import { HTMLProps } from 'react';

/* NOTE: The mapbox static maps api seems like it would be ideal for this, but it is too unreliable. I get 404
 errors, especially when I display a number of maps at once. Other users report similar issues. */

export default function TrackPreview({
  polyline,
  width,
  height,
  ...divProps
}: {
  polyline: string;
  width: number;
  height: number;
} & HTMLProps<HTMLDivElement>) {
  const url = `https://staticmap.plantopo.com?w=${width}&h=${height}&f&p=5&lh=3&lw=3&lc=%231c4ed8&l=${encodeURIComponent(polyline)}`;

  return (
    <div
      {...divProps}
      style={{
        width: width + 'px',
        height: height + 'px',
        backgroundImage: `url(${url}`,
      }}
      className="rounded-md clip bg-cover"
    />
  );
}
