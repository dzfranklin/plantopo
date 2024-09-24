import type { Meta, StoryObj } from '@storybook/react';

import { PNavbar } from './Nav';
import { loggedOutUserHandlers } from '@/.storybook/preview';

const meta = {
  component: PNavbar,
} satisfies Meta<typeof PNavbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => (
    <div className="relative isolate flex w-full flex-col bg-white lg:bg-zinc-100 h-full">
      <div className="px-4">
        <PNavbar />
      </div>
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
