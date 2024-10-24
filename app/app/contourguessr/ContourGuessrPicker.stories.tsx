import type { Meta, StoryObj } from '@storybook/react';

import { ContourGuessrPicker } from './ContourGuessrPicker';
import { useState } from 'react';
import JSONView from '@/components/JSONView';

const meta = {
  component: ContourGuessrPicker,
} satisfies Meta<typeof ContourGuessrPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    options: {},
    setOptions: () => {},
  },
  render: (props) => {
    const [options, setOptions] = useState(props.options);
    return (
      <div className="m-6 sm:grid grid-cols-2 grid-rows-1">
        <div className="border border-gray-500 border-dashed">
          <ContourGuessrPicker
            {...props}
            options={options}
            setOptions={setOptions}
          />
        </div>

        <JSONView data={options} />
      </div>
    );
  },
};
