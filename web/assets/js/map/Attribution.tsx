import Dialog from './components/Dialog';
import { SyncState } from './sync/types';
import DOMPurify from 'dompurify';
import useResources from './useResources';
import { LayerData, LayerSource } from './layers/types';
import useSyncSelector from './sync/useSyncSelector';
import './Attribution.css';

export default function Attribution() {
  const resources = useResources();
  const layers = useSyncSelector((state) => state.layers);

  if (resources.status === 'loading' || resources.status === 'error') {
    return null;
  }

  const { layerSource: layerSources, layerData } = resources.data;

  const activeSources = layers
    .map(({ id }) => layerSources[id])
    .filter((s): s is LayerSource => !!s);

  const activeData = activeSources
    .flatMap((s) => s.layerSpecs)
    .map((s) => 'source' in s && layerData[s.source])
    .filter((d): d is LayerData => !!d);

  const showOsImage = activeData.some((d) =>
    d.spec['attribution'].includes('<!-- OS_LOGO -->'),
  );

  return (
    <div className="attribution flex flex-row justify-between items-end gap-[60px]">
      <div className="h-[32px] pb-[8px] flex flex-row min-w-fit pointer-events-none">
        <img src="/images/mapbox_logo.svg" className="h-full" />

        {showOsImage && <img src="/images/os_logo.svg" className="h-full" />}
      </div>

      <Dialog>
        <Dialog.Trigger>
          <button className="attribution--inline px-[5px] py-[2px] truncate text-sm bg-white bg-opacity-50">
            {activeData.map(
              (data, idx) =>
                typeof data.spec['attribution'] === 'string' && (
                  <span key={idx}>
                    {idx != 0 && <span className="mx-[4px]">|</span>}
                    <span
                      dangerouslySetInnerHTML={{
                        __html: safeHtml(data.spec['attribution']),
                      }}
                    />
                  </span>
                ),
            )}
          </button>
        </Dialog.Trigger>

        <Dialog.Title>Attribution</Dialog.Title>

        <ul className="list-disc list-inside attribution--dialog">
          {activeData.map(
            (data, idx) =>
              typeof data.spec['attribution'] === 'string' && (
                <li key={idx} className="mb-2 list-disc">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: safeHtml(data.spec['attribution']),
                    }}
                  />
                </li>
              ),
          )}
        </ul>
      </Dialog>
    </div>
  );
}

const sanitizeCache = new Map<string, string>();

DOMPurify.addHook('uponSanitizeElement', (node, _data, _config) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function safeHtml(input: string): string {
  const cached = sanitizeCache.get(input);
  if (cached) return cached;

  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['a', 'strong', 'i', 'em', 'b'],
    ALLOWED_ATTR: ['href'],
  });

  sanitizeCache.set(input, sanitized);
  return sanitized;
}
