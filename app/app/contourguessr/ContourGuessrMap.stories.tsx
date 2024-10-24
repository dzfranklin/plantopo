import type { Meta, StoryObj } from '@storybook/react';

import { ContourGuessrMap } from './ContourGuessrMap';
import { useState } from 'react';
import { ResizableContainer } from '@/components/ResizableContainer';

const meta = {
  component: ContourGuessrMap,
} satisfies Meta<typeof ContourGuessrMap>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    view: 'osLandranger',
    target: [-4.465, 56.814],
    boundsMeters: 1_000,
    showAnswer: false,
    guess: null,
    setGuess: () => {},
  },
  render: (props) => {
    const [guess, setGuess] = useState<[number, number] | null>(null);
    return (
      <ResizableContainer initialWidth={800} initialHeight={600}>
        <ContourGuessrMap {...props} guess={guess} setGuess={setGuess} />
      </ResizableContainer>
    );
  },
};

export const ShowAnswer: Story = {
  ...Default,
  args: {
    ...Default.args,
    guess: [-4.463, 56.816],
    showAnswer: true,
  },
  render: (props) => (
    <ResizableContainer initialWidth={800} initialHeight={600}>
      <ContourGuessrMap {...props} />
    </ResizableContainer>
  ),
};
