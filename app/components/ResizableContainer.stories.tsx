import type { Meta, StoryObj } from '@storybook/react';

import { ResizableContainer } from './ResizableContainer';

const meta = {
  component: ResizableContainer,
} satisfies Meta<typeof ResizableContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div className="bg-blue-700 w-full h-full" />,
  },
};
