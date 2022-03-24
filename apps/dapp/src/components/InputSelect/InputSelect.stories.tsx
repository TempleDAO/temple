import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';

import { InputSelect } from './InputSelect';

export default {
  title: 'Components/InputSelect',
  component: InputSelect,
  parameters: {
    layout: 'centered',
  },
} as ComponentMeta<typeof InputSelect>;

const Template: ComponentStory<typeof InputSelect> = (args) => (
  <InputSelect {...args} />
);

export const Primary = Template.bind({});
const storyOptions = [
  { value: '$FRAX', label: '$FRAX' },
  { value: '$TEMPLE', label: '$TEMPLE' },
  { value: '$ETH', label: '$ETH' },
];
Primary.args = {
  options: storyOptions,
  defaultValue: { value: '$ETH', label: '$ETH' },
};
