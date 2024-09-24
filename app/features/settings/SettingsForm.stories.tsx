import type { Meta, StoryObj } from '@storybook/react';

import { SettingsForm } from './SettingsForm';

const meta = {
  component: SettingsForm,
} satisfies Meta<typeof SettingsForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
