import type { Meta, StoryObj } from '@storybook/react';

import { Layout } from './Layout';
import { loggedOutUserHandlers } from '@/.storybook/preview';

const meta = {
  component: Layout,
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => (
    <Layout pageTitle="Page title">
      <p>
        Lorem Ipsum is simply dummy text of the printing and typesetting
        industry. Lorem Ipsum has been the industry&apos;s standard dummy text
        ever since the 1500s, when an unknown printer took a galley of type and
        scrambled it to make a type specimen book. It has survived not only five
        centuries, but also the leap into electronic typesetting, remaining
        essentially unchanged. It was popularised in the 1960s with the release
        of Letraset sheets containing Lorem Ipsum passages, and more recently
        with desktop publishing software like Aldus PageMaker including versions
        of Lorem Ipsum.
      </p>
    </Layout>
  ),
};

export const LoggedOut: Story = {
  ...Default,
  parameters: {
    ...Default.parameters,
    msw: {
      handlers: {
        user: loggedOutUserHandlers,
      },
    },
  },
};
