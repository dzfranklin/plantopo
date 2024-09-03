import type { Meta, StoryObj } from '@storybook/react';

import { LoginScreen } from './LoginScreen';

const meta = {
  component: LoginScreen,
} satisfies Meta<typeof LoginScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Login: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    isSignup: false,
    returnTo: '#',
  },
};

export const Signup: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    isSignup: true,
    returnTo: '#',
  },
};
