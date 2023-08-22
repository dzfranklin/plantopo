import osLogo from './osLogo.svg';
import mapboxLogo from './mapboxLogo.svg';
import { SyncEngine } from '@/sync/SyncEngine';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { LAYERS } from '@/layers';
import stringOrd from '@/stringOrd';
import { Content, Dialog, DialogContainer } from '@adobe/react-spectrum';

type Attribs = { id: string; html: string }[];
type Logos = { alt: string; src: string }[];

export function AttributionControl({
  sidebarWidth,
  engine,
}: {
  sidebarWidth: number;
  engine: SyncEngine;
}) {
  const [logos, setLogos] = useState<Logos>([]);
  const [attribs, setAttribs] = useState<Attribs>([]);
  useEffect(() => {
    const attribs = toAttribHtml(engine.lOrder());
    setAttribs(attribs);
    setLogos(toLogos(attribs));

    const l = engine.addLOrderListener((v) => {
      const attribs = toAttribHtml(v);
      setAttribs(attribs);
      setLogos(toLogos(attribs));
    });
    return () => engine.removeLOrderListener(l);
  }, [engine]);

  const [openFull, setOpenFull] = useState(false);

  return (
    <div
      className="absolute bottom-0 right-0 z-10 flex items-end min-w-0 gap-3 ml-2 mr-16"
      style={{ left: `${sidebarWidth}px` }}
    >
      {logos.length > 0 && (
        <div className="min-w-fit h-[20px] mb-1 flex gap-1 pointer-events-none">
          {logos.map(({ alt, src }) => (
            <img src={src} alt={alt} key={src} />
          ))}
        </div>
      )}

      <AttribPreview attribs={attribs} setOpenFull={setOpenFull} />

      <DialogContainer type="modal" onDismiss={() => setOpenFull(false)}>
        {openFull && (
          <Dialog isDismissable>
            <Content>
              <AttribFull attribs={attribs} />
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
      className="px-[5px] h-min truncate bg-white bg-opacity-50 rounded-sm"
    >
      {attribs.map(({ id, html }, i) => (
        <span key={id} className="prose-sm">
          {i > 0 && <span>, </span>}
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </span>
      ))}
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

function toAttribHtml(layers: number[]): { id: string; html: string }[] {
  const attribs = [];
  const tilesets = new Set<string>();
  for (const lid of layers) {
    const ldata = LAYERS.layers[lid];
    if (!ldata) continue;
    if (ldata.attribution !== undefined) {
      const html = rewriteHtml(ldata.attribution);
      attribs.push({ id: `layer-${lid}`, html });
    }
    for (const tid of ldata.sublayerTilesets) {
      tilesets.add(tid);
    }
  }
  for (const tid of tilesets) {
    const tdata = LAYERS.tilesets[tid];
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
  const logos = [];
  for (const { html } of attribs) {
    if (html.includes('SHOW_OS_LOGO')) {
      logos.push({ alt: 'ordnance survey', src: osLogo.src });
    }
    if (html.includes('SHOW_MAPBOX_LOGO')) {
      logos.push({ alt: 'mapbox', src: mapboxLogo.src });
    }
  }
  return logos;
}

function rewriteHtml(html: string): string {
  return html.replaceAll('CURRENT_YEAR', new Date().getFullYear().toString());
}
