import type { Meta, StoryObj } from '@storybook/react';

import { TrackScreen } from './TrackScreen';
import { delay, http, HttpResponse } from 'msw';
import { API_ENDPOINT } from '@/env';
import { sampleTrack, sampleTrackElevation } from '@/.storybook/samples/tracks';
import { Track } from '@/features/tracks/schema';

const meta = {
  component: TrackScreen,
} satisfies Meta<typeof TrackScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

let trackState: Track = sampleTrack;

export const Default: Story = {
  args: { id: 't_0690eb1rkhz3nay1g8ppt254k0' },
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: {
        tracks: [
          http.get(API_ENDPOINT + 'tracks/track/*', async () => {
            await delay();
            return HttpResponse.json({
              track: trackState,
            });
          }),
          http.patch(API_ENDPOINT + 'tracks/track/*', async (req) => {
            await delay();
            const update = ((await req.request.json()) as any).track;
            trackState = { ...trackState, ...update };
            return HttpResponse.json({ track: trackState });
          }),
          http.delete(API_ENDPOINT + 'tracks/track/*', async () => {
            await delay();
            return HttpResponse.json({});
          }),
        ],
        elevation: [
          http.post(API_ENDPOINT + 'elevation', async () => {
            await delay(3_000);
            return HttpResponse.json({ elevation: sampleTrackElevation });
          }),
        ],
      },
    },
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    ...Default.parameters,
    msw: {
      ...Default.parameters!.msw,
      handlers: {
        ...Default.parameters!.msw!.handlers,
        tracks: [http.all(API_ENDPOINT + 'tracks/*', () => delay('infinite'))],
      },
    },
  },
};

export const UpdateLoading: Story = {
  ...Default,
  parameters: {
    ...Default.parameters,
    msw: {
      ...Default.parameters!.msw,
      handlers: {
        ...Default.parameters!.msw!.handlers,
        tracks: [
          http.get(API_ENDPOINT + 'tracks/track/*', async () => {
            await delay();
            return HttpResponse.json({
              track: trackState,
            });
          }),
          http.patch(API_ENDPOINT + 'tracks/track/*', () => delay('infinite')),
        ],
      },
    },
  },
};
