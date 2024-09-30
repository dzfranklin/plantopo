import type { Meta, StoryObj } from '@storybook/react';

import { MapSearchComponent } from './MapSearchComponent';
import { useState } from 'react';
import JSONView from '@/components/JSONView';

const meta = {
  component: MapSearchComponent,
} satisfies Meta<typeof MapSearchComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: (props) => {
    const [selected, setSelected] = useState<unknown>(null);
    return (
      <div className="p-4">
        <div className="max-w-lg">
          <MapSearchComponent {...props} setSelected={setSelected} />
        </div>
        <div className="mt-80">
          <JSONView data={{ selected }} />
        </div>
      </div>
    );
  },
};
