import type { Meta, StoryObj } from '@storybook/react';

import { MapComponent } from './MapComponent';
import { clearInitialView } from '@/features/map/initialView';
import { ResizableContainer } from '@/components/ResizableContainer';

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
    <ResizableContainer initialWidth={400} initialHeight={300}>
      <MapComponent {...props} />
    </ResizableContainer>
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

export const OSExplorer: Story = {
  ...Default,
  args: {
    initialBaseStyle: 'os',
    initialCamera: {
      lng: -3.4,
      lat: 56.5,
      zoom: 6,
    },
  },
};

export const Large: Story = {
  ...Default,
  render: (props) => (
    <ResizableContainer initialWidth={800} initialHeight={600}>
      <MapComponent {...props} />
    </ResizableContainer>
  ),
};

export const Rounded: Story = {
  ...Default,
  render: (props) => (
    <ResizableContainer
      initialWidth={400}
      initialHeight={300}
      className="rounded-lg overflow-clip"
    >
      <MapComponent {...props} />
    </ResizableContainer>
  ),
};

export const Multiple: Story = {
  ...Default,
  render: (props) => (
    <div className="space-y-2">
      <ResizableContainer initialWidth={400} initialHeight={300}>
        <MapComponent {...props} />
      </ResizableContainer>

      <ResizableContainer initialWidth={400} initialHeight={300}>
        <MapComponent {...props} />
      </ResizableContainer>
    </div>
  ),
};
