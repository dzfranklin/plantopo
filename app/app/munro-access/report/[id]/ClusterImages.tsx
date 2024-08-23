import { MunroList } from './report';

type Munro = MunroList['features'][number];

interface MunroWithPhoto extends Munro {
  properties: Munro['properties'] & {
    photo: NonNullable<Munro['properties']['photo']>;
  };
}

export function ClusterImages({ munros }: { munros: Munro[] }) {
  return (
    <div className="overflow-hidden rounded-lg bg-gray-50">
      <div className="px-4 py-5 sm:p-6 flex gap-16 overflow-y-hidden overflow-x-auto">
        {munros.map(
          (munro) =>
            'photo' in munro.properties && (
              <PictureComponent
                key={munro.id}
                munro={munro as MunroWithPhoto}
              />
            ),
        )}
      </div>
    </div>
  );
}

function PictureComponent({ munro }: { munro: MunroWithPhoto }) {
  const pic = munro.properties.photo;
  return (
    <div
      style={{
        width: pic.width,
        maxWidth: pic.width,
      }}
    >
      <p className="font-semibold text-gray-600 mb-3 truncate">
        {munro.properties.name}
      </p>
      <img
        src={pic.source}
        alt={munro.properties.name}
        style={{
          width: pic.width,
          maxWidth: pic.width,
          height: pic.height,
          maxHeight: pic.height,
        }}
      />
      <p
        className="mt-0.5 text-sm text-gray-800 truncate text-right"
        title={pic.author + ' ' + pic.sourceText}
      >
        {pic.author}{' '}
        {pic.sourceLink ? (
          <a href={pic.sourceLink} className="link">
            {pic.sourceText}
          </a>
        ) : (
          pic.sourceText
        )}
      </p>
    </div>
  );
}
