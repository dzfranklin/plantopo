import type { Meta, StoryObj } from '@storybook/react';

import TrackMapComponent from './TrackMapComponent';
import { SettingsForm } from '@/features/settings/SettingsForm';
import { decodePolyline } from '@/features/tracks/polyline';
import { sampleTrack } from '@/.storybook/samples/tracks';

const meta = {
  parameters: { layout: 'fullscreen' },
  component: TrackMapComponent,
  render: (args) => (
    <div className="h-screen w-screen p-8 grid grid-cols-1 grid-rows-[min-content_minmax(0,1fr)]">
      <div className="border border-gray-700 rounded mb-10 p-2">
        <details>
          <summary>Settings</summary>
          <SettingsForm />
        </details>
      </div>

      <div className="h-full w-full">
        <TrackMapComponent {...args} />
      </div>
    </div>
  ),
} satisfies Meta<typeof TrackMapComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

const line = decodePolyline(sampleTrack.line);

export const Default: Story = {
  args: {
    line,
  },
};
