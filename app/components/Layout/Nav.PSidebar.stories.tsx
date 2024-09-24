import type { Meta, StoryObj } from '@storybook/react';

import { PSidebar } from './Nav';
import { loggedOutUserHandlers } from '@/.storybook/preview';

const meta = {
  component: PSidebar,
} satisfies Meta<typeof PSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => (
    <div className="w-full max-w-[320px] h-[568px] mx-auto">
      <PSidebar />
    </div>
  ),
};

export const LoggedOut: Story = {
  ...LoggedIn,
  parameters: {
    ...LoggedIn.parameters,
    msw: {
      handlers: {
        user: loggedOutUserHandlers,
      },
    },
  },
};
