import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import Tooltip from './Tooltip';

export default {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
} as ComponentMeta<typeof Tooltip>;

const Template: ComponentStory<typeof Tooltip> = (args) => (
  <Tooltip {...args} />
);

export const Default = Template.bind({});
Default.args = {
  children: <>HOVER FOR TOOLTIP</>,
  content:
    'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Libero, tempore?',
  position: 'top',
};
