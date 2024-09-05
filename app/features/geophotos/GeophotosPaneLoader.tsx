import { $api } from '@/api/client';
import { components } from '@/api/v1';
import { Timestamp } from '@/components/Timestamp';
import Skeleton from '@/components/Skeleton';

type Geophoto = components['schemas']['Geophoto'];

const maxPhotosRendered = 8; // To limit load on upstream

export function GeophotosPaneLoader(params: { photos: number[] }) {
  const query = $api.useQuery(
    'get',
    '/geophotos',
    {
      params: { query: { id: params.photos } },
    },
    { enabled: params.photos.length > 0 },
  );
  if (query.error) throw query.error;

  if (!query.data) {
    return <Skeleton height={200} width={200} />;
  }

  return <GeophotosPane photos={query.data.photos} />;
}

export function GeophotosPane({ photos }: { photos: Geophoto[] }) {
  return (
    <ul className="max-h-full flex gap-2 overflow-auto">
      {photos
        .slice(0, Math.min(photos.length, maxPhotosRendered))
        .map((photo) => (
          <li key={photo.id}>
            <PaneItem photo={photo} />
          </li>
        ))}

      {photos.length > maxPhotosRendered && (
        <div className="w-[200px] min-w-[200px] min-h-[200px] rounded bg-gray-200 flex flex-col p-5">
          <div className="grow flex items-center justify-center text-6xl text-gray-500 font-bold text-center">
            ...
          </div>
          <div className="text-xs mt-auto text-gray-700">
            Select fewer images to see them all.
          </div>
        </div>
      )}
    </ul>
  );
}

function PaneItem({ photo }: { photo: Geophoto }) {
  const image = photo.smallImage ?? photo.image;
  const height = Math.min(image.height, 200);
  const width = Math.floor((image.width / image.height) * height);
  return (
    <div className="relative bg-gray-200" style={{ width, height }}>
      <div
        style={{
          backgroundImage: `
            linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0.6) 0%,
              rgba(0, 0, 0, 0) 20%,
              rgba(0, 0, 0, 0) 80%,
              rgba(0, 0, 0, 0.6) 100%
            ),
            url(${image.src})`,
        }}
        className="absolute inset-0 rounded bg-cover"
      />

      <div
        className="absolute top left-0 right-0 text-xs text-white px-2 py-1 truncate"
        style={{ textShadow: '0 1px 0 black' }}
        title={photo.title}
      >
        {photo.dateTaken && (
          <>
            <Timestamp iso={photo.dateTaken} /> -{' '}
          </>
        )}{' '}
        {photo.title}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 text-xs text-white px-2 py-1"
        style={{ textShadow: '0 1px 0 black' }}
      >
        by{' '}
        <a
          className="underline"
          href={photo.attributionLink}
          rel="nofollow"
          target="_blank"
        >
          {photo.attributionText}
        </a>
      </div>
    </div>
  );
}
