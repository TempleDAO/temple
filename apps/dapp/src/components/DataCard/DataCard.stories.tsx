import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { DataCard } from './DataCard';

export default {
  title: 'Components/DataCard',
  component: DataCard,
  parameters: {
    layout: 'padded',
  },
} as ComponentMeta<typeof DataCard>;

const Template: ComponentStory<typeof DataCard> = (args) => (
  <DataCard {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  title: 'TITLE',
  data: '12,500',
  tooltipContent: 'description of this card',
};
