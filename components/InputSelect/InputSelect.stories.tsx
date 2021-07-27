import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { InputSelect } from './InputSelect';

export default {
  title: 'Components/InputSelect',
  component: InputSelect,
} as ComponentMeta<typeof InputSelect>;

const Template: ComponentStory<typeof InputSelect> = (args) => <InputSelect {...args} />;

export const Primary = Template.bind({});
const storyOptions = [
  { value: 'option1', label: 'option 1' },
  { value: 'option2', label: 'option 2' },
  { value: 'option3', label: 'option 3' },
];
Primary.args = {
  options: storyOptions,
  defaultValue: { value: 'option1', label: 'option 1' },
};

