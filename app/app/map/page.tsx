'use client';

import { Layout } from '@/components/Layout';
import { InitialCamera, MapComponent } from '@/features/map/MapComponent';

export default function Page() {
  const initialCamera =
    typeof location !== 'undefined'
      ? parseInitialCamera(location.hash)
      : undefined;

  return (
    <Layout fullBleed={true}>
      <MapComponent
        initialCamera={initialCamera}
        onMap={(m) => {
          const onMoveEnd = () => {
            const { lng, lat } = m.getCenter();
            location.hash = serializeInitialCamera({
              lng,
              lat,
              zoom: m.getZoom(),
              bearing: m.getBearing(),
              pitch: m.getPitch(),
            });
          };

          m.on('moveend', onMoveEnd);
          return () => {
            m.off('movened', onMoveEnd);
          };
        }}
      />
    </Layout>
  );
}

function parseInitialCamera(hash: string): InitialCamera | undefined {
  if (location.hash === '' || location.hash === '#') {
    return undefined;
  }

  const parts = hash
    .replace(/^#/, '')
    .split('/')
    .map((p) => Number.parseFloat(p));

  for (const p of parts) {
    if (Number.isNaN(p)) {
      console.warn('invalid hash', hash);
      return undefined;
    }
  }

  if (parts.length < 3) {
    console.warn('invalid hash', hash);
    return undefined;
  }
  const out: InitialCamera = {
    lng: parts[0]!,
    lat: parts[1]!,
    zoom: parts[2]!,
  };

  if (parts.length > 3) {
    out.bearing = parts[3]!;
  }

  if (parts.length > 4) {
    out.pitch = parts[4]!;
  }

  return out;
}

function serializeInitialCamera(value: InitialCamera): string {
  const out = [
    value.lng.toFixed(6),
    value.lat.toFixed(6),
    value.zoom.toFixed(2),
  ];
  if (value.pitch !== undefined && Math.abs(value.pitch) > 0.01) {
    out.push(value.bearing?.toFixed(2) ?? '0.00');
    out.push(value.pitch.toFixed(2));
  } else if (value.bearing !== undefined && Math.abs(value.bearing) > 0.01) {
    out.push(value.bearing.toFixed(2));
  }
  return out.join('/');
}
