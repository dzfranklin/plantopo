import type { Meta, StoryObj } from '@storybook/react';

import { KVTable } from './KVTable';

const meta = {
  component: KVTable,
} satisfies Meta<typeof KVTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    entries: [
      ['Component name', 'KVTable'],
      ['Description', 'A way to display ordered key-value entries'],
    ],
  },
};
