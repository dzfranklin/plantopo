import type { Meta, StoryObj } from '@storybook/react';

import { TracksUploadControl } from './TracksUploadControl';
import { API_ENDPOINT } from '@/env';
import { delay, http, HttpResponse } from 'msw';
import { Track, TrackCreate } from '@/features/tracks/schema';
import { DateTime } from 'luxon';

const meta = {
  component: TracksUploadControl,
  render: (args) => (
    <div>
      <div className="border border-gray-700 rounded mb-10 p-2 prose">
        <p>Sample files to try:</p>
        <ul>
          <li>
            <a href="https://pt-samples.s3.eu-west-2.amazonaws.com/garmin_explore_example.gpx">
              garmin_explore_example.gpx
            </a>
          </li>
          <li>
            <a href="https://pt-samples.s3.eu-west-2.amazonaws.com/sample_hike.gpx">
              sample_hike.gpx
            </a>
          </li>
        </ul>
      </div>

      <TracksUploadControl {...args} />
    </div>
  ),
} satisfies Meta<typeof TracksUploadControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    layout: 'padded',
    msw: {
      handlers: {
        tracks: [
          http.post(API_ENDPOINT + 'tracks', async (req) => {
            await delay();
            const reqBody = (await req.request.json()) as any;
            return HttpResponse.json({
              tracks: reqBody.tracks.map(
                (track: TrackCreate, i: number): Track => ({
                  id: 't_0690dv48g1wkkbxy4jrhy30mhm' + i,
                  ownerID: 'u_068anhrmfdvb57tw9etp7geqsr',
                  date: track.date,
                  dateUploaded: DateTime.now().toUTC().toISO(),
                  lengthMeters: 1000,
                  line: track.line,
                  times: track.times,
                }),
              ),
            });
          }),
        ],
      },
    },
  },
  args: {
    onDone: () => alert('Done'),
  },
};

export const InfiniteSubmitWait: Story = {
  ...Default,
  parameters: {
    ...Default.parameters,
    msw: {
      handlers: {
        tracks: [
          http.post(API_ENDPOINT + 'tracks', async () => {
            await delay('infinite');
          }),
        ],
      },
    },
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    ...Default.parameters,
    msw: {
      handlers: {
        tracks: [
          http.post(API_ENDPOINT + 'tracks', async () => {
            await delay();
            return HttpResponse.error();
          }),
        ],
      },
    },
  },
};

export const BadRequestError: Story = {
  ...Default,
  parameters: {
    ...Default.parameters,
    msw: {
      handlers: {
        tracks: [
          http.post(API_ENDPOINT + 'tracks', async () => {
            await delay();
            return HttpResponse.json(
              { message: 'invalid request' },
              { status: 400 },
            );
          }),
        ],
      },
    },
  },
};
