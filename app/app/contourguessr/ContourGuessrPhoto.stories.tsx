import type { Meta, StoryObj } from '@storybook/react';

import { ContourGuessrPhoto } from './ContourGuessrPhoto';

const meta = {
  component: ContourGuessrPhoto,
} satisfies Meta<typeof ContourGuessrPhoto>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    attributionText: 'Jim Barton (geograph.org.uk)',
    attributionLink: 'https://www.geograph.org.uk/photo/5218815',
    url: 'https://s0.geograph.org.uk/geophotos/05/21/88/5218815_b165ac24_original.jpg',
    width: 1024,
    height: 678,
    dateTaken: '2016-12-03T00:00:00.000000Z',
  },
};
