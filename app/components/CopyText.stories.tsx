import type { Meta, StoryObj } from '@storybook/react';

import { CopyText } from './CopyText';

const meta = {
  component: CopyText,
} satisfies Meta<typeof CopyText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value:
      'https://www.google.com/maps/@56.3084574,-2.76609,5194m/data=!3m1!1e3?entry=ttu&g_ep=EgoyMDI0MTAyMS4xIKXMDSoASAFQAw%3D%3D',
  },
  decorators: [
    (Story) => (
      <div className="min-w-[300px]">
        <Story />
      </div>
    ),
  ],
};

export const FullWidth: Story = {
  args: {
    value: 'https://plantopo.com/cg/123',
    fullWidth: true,
  },
  decorators: [
    (Story) => (
      <div className="w-[600px]">
        <Story />
      </div>
    ),
  ],
};
