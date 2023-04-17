import initCore, * as core from '../../../../sync/web/pkg/plantopo_sync_web';

export const setup = async (clientId: number) => {
  await initCore();
  core.setup(clientId);
  window._dbg.sync.core = core;
};

const wsUrl = (map_id: string) => {
  const hostname = location.hostname;

  let proto: string;
  let port: string;
  if (location.protocol == 'https:') {
    proto = 'wss';
    port = '4005';
  } else {
    proto = 'ws';
    port = '4004';
  }

  return `${proto}://${hostname}:${port}/ws/${map_id}`;
};
