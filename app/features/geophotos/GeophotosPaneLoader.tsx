import { $api } from '@/api/client';
import { components } from '@/api/v1';

type Geophoto = components['schemas']['Geophoto'];

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
    return <div>Loading...</div>;
  }

  return <GeophotosPane photos={query.data.photos} />;
}

export function GeophotosPane({ photos }: { photos: Geophoto[] }) {
  // TODO: window so that only a few are rendered at once to reduce load amplification
  photos = photos.slice(0, Math.min(3, photos.length));

  return (
    <ul className="overflow-auto max-h-full flex">
      {photos.map((photo) => (
        <li key={photo.id}>
          <PaneItem photo={photo} />
        </li>
      ))}
    </ul>
  );
}

function PaneItem({ photo }: { photo: Geophoto }) {
  const image = photo.smallImage ?? photo.image;
  console.log({ id: photo.id, image });
  const height = Math.min(image.height, 200);
  const width = Math.floor((image.width / image.height) * height);
  return (
    <div>
      <img
        src={image.src}
        width={image.width}
        height={image.height}
        style={{ width, height }}
        alt=""
      />
    </div>
  );
}
