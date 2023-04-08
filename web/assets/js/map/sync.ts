import initCore, * as core from '../../../../sync/web/pkg/web';

export const setup = async (clientId: number) => {
  await initCore();
  core.setup(clientId);
  window._dbg.sync.core = core;
};
