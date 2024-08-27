import type { Meta, StoryObj } from '@storybook/react';

import { WaitForReportComponent } from './WaitForReportComponent';
import { Layout } from '@/components/Layout';

const meta = {
  component: WaitForReportComponent,
  decorators: [
    (Story) => (
      <Layout wide={false}>
        <Story />
      </Layout>
    ),
  ],
} satisfies Meta<typeof WaitForReportComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
