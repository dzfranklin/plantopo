import type { Meta, StoryObj } from '@storybook/react';

import { EditTrackFileUploadControl } from './EditTrackFileUploadControl';
import { ParsedTrack } from '@/features/tracks/upload/schema';
import { useState } from 'react';

const meta = {
  component: EditTrackFileUploadControl,
  render: (args) => {
    const [state, setState] = useState(args.track);
    return (
      <EditTrackFileUploadControl
        track={state}
        dispatch={(action) => {
          switch (action.action) {
            case 'edit':
              setState((p) => ({
                ...p,
                contents: p.contents?.map((entry, i) =>
                  i === action.payload.track
                    ? { ...entry, ...action.payload.value }
                    : entry,
                ),
              }));
              break;
            default:
              alert(action.action);
              break;
          }
          args.dispatch(action);
        }}
      />
    );
  },
} satisfies Meta<typeof EditTrackFileUploadControl>;

export default meta;

type Story = StoryObj<typeof meta>;

const mockFile = (name: string) => ({ name, size: 734208 }) as File;

const sampleParsedTrack: ParsedTrack = {
  name: '8/11/2024',
  date: '2024-08-11T05:51:10Z',
  times: ['2024-08-11T05:51:10Z', '2024-08-11T06:15:01Z'],
  line: [
    [-5.04323, 56.449403],
    [-5.0556, 56.44732],
  ],
};

const withContainer = (Story: any) => (
  <div className="w-full max-w-lg sm:m-4">
    <Story />
  </div>
);

export const Default: Story = {
  decorators: [withContainer],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    dispatch: () => {},
    track: {
      id: 0,
      file: mockFile('export.gpx'),
      contents: [sampleParsedTrack],
    },
  },
};

export const Parsing: Story = {
  ...Default,
  args: {
    ...Default.args,
    track: {
      ...Default.args.track,
      contents: undefined,
    },
  },
};

export const MultiTrack: Story = {
  ...Default,
  args: {
    ...Default.args,
    track: {
      id: 0,
      file: mockFile('export.gpx'),
      contents: [
        {
          name: 'Part 1',
          date: '2024-08-11T05:51:10Z',
          times: ['2024-08-11T05:51:10Z', '2024-08-11T06:15:01Z'],
          line: [
            [-5.04323, 56.449403],
            [-5.0556, 56.44732],
          ],
        },
        {
          name: 'Part 2',
          date: '2024-08-11T05:30:00Z',
          times: ['2024-08-11T05:30:00Z', '2024-08-11T05:45:00Z'],
          line: [
            [-5.0556, 56.44732],
            [-5.07, 56.5],
          ],
        },
      ],
    },
  },
};

export const WithoutTime: Story = {
  ...Default,
  args: {
    ...Default.args,
    track: {
      id: 0,
      file: mockFile('export.gpx'),
      contents: [{ ...sampleParsedTrack, date: undefined, times: undefined }],
    },
  },
};

export const WithParseError: Story = {
  ...Default,
  args: {
    ...Default.args,
    track: {
      id: 0,
      file: mockFile('export.gpx'),
      parseError: 'tracks with multiple segments are not currently supported',
    },
  },
};
