import osLogo from './osLogo.svg';
import mapboxLogo from './mapboxLogo.svg';
import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import stringOrd from '@/generic/stringOrd';
import { Content, Dialog, DialogContainer } from '@adobe/react-spectrum';
import { MapSources } from '../../api/mapSources';
import { SceneLayer } from '../../engine/Scene';
import { useEngine, useSceneSelector } from '../../engine/useEngine';

type Attribs = { id: string; html: string }[];
type Logos = { alt: string; src: string }[];

export function AttributionControl() {
  const sidebarWidth = useSceneSelector((s) => s.sidebarWidth);
  const activeLayers = useSceneSelector((s) => s.layers.active);
  const engine = useEngine();
  const sources = engine?.sources;

  const value = useMemo(() => {
    const attribs = toAttribHtml(activeLayers, sources);
    return {
      logos: toLogos(attribs),
      attribs,
    };
  }, [sources, activeLayers]);

  const [openFull, setOpenFull] = useState(false);

  return (
    <div
      className="absolute bottom-0 right-0 z-20 flex items-end min-w-0 gap-3 ml-2 mr-16"
      style={{ left: `${sidebarWidth}px` }}
    >
      {value.logos.length > 0 && (
        <div className="min-w-fit h-[20px] mb-1 flex gap-1 pointer-events-none">
          {value.logos.map(({ alt, src }) => (
            <img src={src} alt={alt} key={src} />
          ))}
        </div>
      )}

      <AttribPreview attribs={value.attribs} setOpenFull={setOpenFull} />

      <DialogContainer type="modal" onDismiss={() => setOpenFull(false)}>
        {openFull && (
          <Dialog isDismissable>
            <Content>
              <AttribFull attribs={value.attribs} />
            </Content>
          </Dialog>
        )}
      </DialogContainer>
    </div>
  );
}

function AttribPreview({
  attribs,
  setOpenFull,
}: {
  attribs: Attribs;
  setOpenFull: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <button
      onClick={() => setOpenFull(true)}
      className="flex gap-2 h-min px-[5px] bg-white bg-opacity-50 rounded-sm"
    >
      <div className="truncate">
        {attribs.map(({ id, html }, i) => (
          <span key={id} className="prose-sm">
            {i > 0 && <span>, </span>}
            <span dangerouslySetInnerHTML={{ __html: html }} />
          </span>
        ))}
      </div>
      <div className="prose-sm truncate">
        PlanTopo version {process.env.NEXT_PUBLIC_PT_VER || '<unspecified>'}
      </div>
    </button>
  );
}

function AttribFull({ attribs }: { attribs: Attribs }) {
  return (
    <ul className="list-disc list-inside">
      {attribs.map(({ id, html }) => (
        <li key={id} className="mb-2 prose-sm">
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </li>
      ))}
    </ul>
  );
}

function toAttribHtml(
  layers: SceneLayer[],
  sources?: MapSources,
): { id: string; html: string }[] {
  const attribs = [];
  const tilesets = new Set<string>();
  for (const layer of layers) {
    if (layer.source.attribution !== undefined) {
      const html = rewriteHtml(layer.source.attribution);
      attribs.push({ id: `layer-${layer.id}`, html });
    }
    for (const tid of layer.source.sublayerTilesets) {
      tilesets.add(tid);
    }
  }
  for (const tid of tilesets) {
    const tdata = sources?.tilesets[tid];
    if (!tdata) continue;
    if ('attribution' in tdata && tdata.attribution !== undefined) {
      const html = rewriteHtml(tdata.attribution);
      attribs.push({ id: `tileset-${tid}`, html });
    }
  }
  attribs.sort((a, b) => stringOrd(a.id, b.id));
  return attribs;
}

function toLogos(attribs: Attribs): Logos {
  const logos = new Map<string, string>();
  for (const { html } of attribs) {
    if (html.includes('SHOW_OS_LOGO')) {
      logos.set(osLogo.src, 'ordnance survey');
    }
    if (html.includes('SHOW_MAPBOX_LOGO')) {
      logos.set(mapboxLogo.src, 'mapbox');
    }
  }
  return [...logos.entries()].map(([src, alt]) => ({ src, alt }));
}

function rewriteHtml(html: string): string {
  return html.replaceAll('CURRENT_YEAR', new Date().getFullYear().toString());
}
