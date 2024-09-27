import type { Meta, StoryObj } from '@storybook/react';

import { LayersControl } from './LayersControl';
import { useState } from 'react';
import {
  BaseStyle,
  defaultBaseStyle,
  OverlayStyle,
} from '@/features/map/style';

const meta = {
  component: LayersControl,
} satisfies Meta<typeof LayersControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeBase: defaultBaseStyle,
    setActiveBase: () => {},
    activeOverlays: [],
    setActiveOverlays: () => {},
  },
  render: () => <Container />,
};

function Container() {
  const [activeBase, setActiveBase] = useState<BaseStyle>(defaultBaseStyle);
  const [activeOverlays, setActiveOverlays] = useState<OverlayStyle[]>([]);
  return (
    <LayersControl
      activeBase={activeBase}
      setActiveBase={setActiveBase}
      activeOverlays={activeOverlays}
      setActiveOverlays={setActiveOverlays}
    />
  );
}
