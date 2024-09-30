import type { Preview } from '@storybook/react';
import * as mswAddon from 'msw-storybook-addon';
import { Layout } from './Layout';
import { delay, http, HttpResponse, passthrough } from 'msw';
// noinspection ES6PreferShortImport
import { API_ENDPOINT } from '../env';
import { sampleUser } from '@/.storybook/samples/users';
import { benAlderGeosearchResponse } from '@/.storybook/samples/geosearch';

mswAddon.initialize({ onUnhandledRequest: 'error' });

const mockSettings: Record<string, unknown> = {};

export const loggedOutUserHandlers = [
  http.get(API_ENDPOINT + 'settings', async () => {
    await delay();
    return HttpResponse.json(
      { code: 401, message: 'not logged in' },
      { status: 401 },
    );
  }),
  http.put(API_ENDPOINT + 'settings', async () => {
    await delay();
    return HttpResponse.json(
      { code: 401, message: 'not logged in' },
      { status: 401 },
    );
  }),
  http.post(API_ENDPOINT + 'auth/check', async () => {
    await delay();
    return HttpResponse.json(
      { code: 401, message: 'not logged in' },
      { status: 401 },
    );
  }),
  http.get(API_ENDPOINT + 'auth/me', async () => {
    await delay();
    return HttpResponse.json(
      { code: 401, message: 'not logged in' },
      { status: 401 },
    );
  }),
];

export const loggedInUserHandlers = [
  http.get(API_ENDPOINT + 'settings', async () => {
    await delay();
    return HttpResponse.json({ settings: mockSettings });
  }),
  http.put(API_ENDPOINT + 'settings', async (req) => {
    await delay();
    const update = (await req.request.json()) as any;
    for (const [k, v] of Object.entries(update.settings)) {
      mockSettings[k] = v;
    }
    return HttpResponse.json({ ...mockSettings });
  }),
  http.post(API_ENDPOINT + 'auth/check', async () => {
    await delay();
    return HttpResponse.json({ userID: sampleUser.id });
  }),
  http.get(API_ENDPOINT + 'auth/me', async () => {
    await delay();
    return HttpResponse.json({ user: sampleUser });
  }),
  http.post(API_ENDPOINT + 'auth/revoke-browser', async () => {
    await delay();
    return HttpResponse.json({});
  }),
];

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    msw: {
      handlers: {
        storybookInternal: [http.all('http://localhost:6006/*', passthrough)],
        mapbox: [
          http.all('https://api.mapbox.com/*', () => passthrough()),
          http.all('https://events.mapbox.com/*', () => passthrough()),
        ],
        maptiler: [http.all('https://api.maptiler.com/*', () => passthrough())],
        maplibreDemoTiles: [
          http.all('https://demotiles.maplibre.org/*', () => passthrough()),
        ],
        osMaps: [http.all('https://api.os.uk/maps/*', () => passthrough())],
        pmtiles: [
          http.all('https://pmtiles.plantopo.com/*', () => passthrough()),
        ],
        tnmBasemap: [
          http.all('https://basemap.nationalmap.gov/*', () => passthrough()),
        ],
        user: loggedInUserHandlers,
        geosearch: [
          http.get(API_ENDPOINT + 'geosearch', async (req) => {
            const params = new URL(req.request.url).searchParams;
            const text = (params.get('text') as string).toLowerCase();

            await delay();

            if ('ben alder'.startsWith(text)) {
              return HttpResponse.json(benAlderGeosearchResponse);
            } else {
              return HttpResponse.json({ results: [] });
            }
          }),
        ],
      },
    },
  },
  loaders: [mswAddon.mswLoader],
  decorators: [
    (Story) => (
      <Layout>
        {/*<ResetQueries />*/}
        <Story />
      </Layout>
    ),
  ],
};

export default preview;
