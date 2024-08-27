import type { Meta, StoryObj } from '@storybook/react';

import RequestReportComponent from './RequestReportComponent';

const meta = {
  component: RequestReportComponent,
} satisfies Meta<typeof RequestReportComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    layout: 'centered',
  },
};
