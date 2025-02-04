import type { Meta, StoryObj } from '@storybook/react';

import { InspectPopupContents } from './InspectPopup';

const meta = {
  component: InspectPopupContents,
} satisfies Meta<typeof InspectPopupContents>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    inspections: [
      { sourceName: 'Source 1', body: <p>Single line inspection</p> },
      {
        sourceName: 'Source 2',
        body: (
          <p>
            {'Multi line inspection jalsdkjflasdkjflasdkjflsakdfjlskdjfldksfj '.repeat(
              100,
            )}
          </p>
        ),
      },
    ],
  },
  render: (args) => (
    <div style={{ height: '300px', width: '240px' }}>
      <InspectPopupContents {...args} />
    </div>
  ),
};

export const SingleInspection: Story = {
  args: {
    inspections: [{ sourceName: 'Source name', body: <p>Inspection one</p> }],
  },
};
