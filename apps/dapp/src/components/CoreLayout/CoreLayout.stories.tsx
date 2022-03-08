import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';

import CoreLayout from './index';

export default {
  title: 'Components/CoreLayout',
  component: CoreLayout,
  parameters: {},
} as ComponentMeta<typeof CoreLayout>;

const Template: ComponentStory<typeof CoreLayout> = () => (
  <CoreLayout />
);

export const Primary = Template.bind({});
Primary.args = {};
