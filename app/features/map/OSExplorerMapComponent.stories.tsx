import type { Meta, StoryObj } from '@storybook/react';

import { OSExplorerMapComponent } from './OSExplorerMapComponent';

const meta = {
  component: OSExplorerMapComponent,
} satisfies Meta<typeof OSExplorerMapComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { center: [0, 51], zoom: 7 },
  render: (props) => (
    <div className="w-[400px] h-[300px]">
      <OSExplorerMapComponent {...props} />
    </div>
  ),
};
