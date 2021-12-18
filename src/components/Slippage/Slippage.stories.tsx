import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import Slippage from './Slippage';

export default {
  title: 'Components/Slippage',
  component: Slippage,
  parameters: {
    layout: 'padded',
  },
} as ComponentMeta<typeof Slippage>;

const Template: ComponentStory<typeof Slippage> = (args) => (
  <Slippage {...args} />
);

export const Default = Template.bind({});
Default.args = {
  value: 1,
  onChange: action('onChange'),
};
