import type { Meta, StoryObj } from '@storybook/react';

import TrackPreview from './TrackPreview';

const meta = {
  component: TrackPreview,
} satisfies Meta<typeof TrackPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    polyline:
      'orsgF{}~_B_AcBDwAoAe@Sm@j@iFpB}HGwFRlG{ClNP~@|A`A^pD_Av@cBTqBvJ@|AqAl@eAiA_Ab@ZhB{CdBXfBm@pAgDpAbCuBwA?yBvABfDvAb@JxBh@p@jB{@dCA|BBbA~@c@tAiAGo@rAeElBzBxJ_CuJ~DsBp@qAtAERwA[_@eGIqCf@c@i@GyBoAi@GoDhBkA|AQAp@q@b@hAQdAsAW}BdCkA?eCb@UxAz@hA]rB{M`De@',
    href: '#',
  },
  render: (args) => (
    <div className="w-[340px] h-[238px]">
      <TrackPreview {...args} />
    </div>
  ),
};
