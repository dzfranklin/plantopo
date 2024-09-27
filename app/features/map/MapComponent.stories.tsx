import type { Meta, StoryObj } from '@storybook/react';

import { MapComponent } from './MapComponent';
import { clearInitialView } from '@/features/map/initialView';

const meta = {
  component: MapComponent,
} satisfies Meta<typeof MapComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

if (typeof window !== 'undefined') {
  clearInitialView();
}

export const Default: Story = {
  render: (props) => (
    <div className="w-[400px] h-[300px]">
      <MapComponent {...props} />
    </div>
  ),
};

export const SimpleGeoJSON: Story = {
  ...Default,
  args: {
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        coordinates: [[-122, 38], [-113, 46], [-102, 34], [-86, 44], [-81, 34]], // prettier-ignore
        type: 'LineString',
      },
    },
    layers: [{ id: 'line', type: 'line', source: 'geojson' }],
    fitGeoJSON: true,
    fitOptions: { padding: 20 },
  },
};

export const Large: Story = {
  ...Default,
  render: (props) => (
    <div className="w-[800px] h-[600px]">
      <MapComponent {...props} />
    </div>
  ),
};

export const Rounded: Story = {
  ...Default,
  render: (props) => (
    <div className="w-[400px] h-[300px] rounded-lg overflow-clip">
      <MapComponent {...props} />
    </div>
  ),
};

export const Multiple: Story = {
  ...Default,
  render: (props) => (
    <div className="space-y-2">
      <div className="w-[400px] h-[300px]">
        <MapComponent {...props} />
      </div>
      <div className="w-[400px] h-[300px]">
        <MapComponent {...props} />
      </div>
    </div>
  ),
};
