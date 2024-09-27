import type { Meta, StoryObj } from '@storybook/react';

import { LayersControl } from './LayersControl';
import { useState } from 'react';
import { BaseStyle, defaultBaseStyle } from '@/features/map/style';

const meta = {
  component: LayersControl,
} satisfies Meta<typeof LayersControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    baseStyle: defaultBaseStyle,
    setBaseStyle: () => {},
  },
  render: () => <Container />,
};

function Container() {
  const [baseStyle, setBaseStyle] = useState<BaseStyle>(defaultBaseStyle);
  return <LayersControl baseStyle={baseStyle} setBaseStyle={setBaseStyle} />;
}
