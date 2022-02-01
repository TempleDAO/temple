import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { PercentageBar } from './PercentageBar';

export default {
  title: 'Components/PercentageBar',
  component: PercentageBar,
} as ComponentMeta<typeof PercentageBar>;

const Template: ComponentStory<typeof PercentageBar> = (args) => (
  <PercentageBar {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  total: 100,
  processed: 69,
};
